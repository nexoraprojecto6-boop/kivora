import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE } from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { PG_POOL } from "./finance.config.js";
import { Mailer } from "./mailer.service.js";
import { audit, one, sql, tx } from "./sql.js";

const TTL_MINUTES = 15;
const COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const hashCode = (userId: string, code: string): Buffer => createHash("sha256").update(`${userId}:${code}`).digest();
const bad = (code: string): ApiException => new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "code", code }] });

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly mailer: Mailer,
  ) {}

  /** Envia (ou reenvia) um código de 6 dígitos. Intervalo mínimo de 60 s entre envios. */
  async send(userId: string, requestId: string): Promise<{ alreadyVerified: boolean }> {
    const user = await one<{ email: string; fullName: string; verified: boolean }>(
      this.pool,
      `SELECT email, full_name AS "fullName", email_verified AS verified FROM users WHERE id = $1`,
      [userId],
    );
    if (!user) throw new ApiException(API_ERROR_CODE.UNAUTHENTICATED);
    if (user.verified) return { alreadyVerified: true };

    const prev = await one<{ wait: number }>(
      this.pool,
      `SELECT GREATEST(0, CEIL($2 - EXTRACT(EPOCH FROM (now() - sent_at))))::int AS wait FROM email_verifications WHERE user_id = $1`,
      [userId, COOLDOWN_SECONDS],
    );
    if (prev && prev.wait > 0) throw new ApiException(API_ERROR_CODE.RATE_LIMITED, { retryAfterSeconds: prev.wait });

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await sql(
      this.pool,
      `INSERT INTO email_verifications (user_id, code_hash, expires_at, attempts, sent_at)
       VALUES ($1, $2, now() + make_interval(mins => $3), 0, now())
       ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = now()`,
      [userId, hashCode(userId, code).toString("hex"), TTL_MINUTES],
    );
    await this.mailer.send(
      user.email,
      "Kivora — código de verificação",
      `Olá ${user.fullName},\n\nO seu código de verificação é: ${code}\n\nÉ válido durante ${TTL_MINUTES} minutos. Se não pediu este código, ignore esta mensagem.\n\nEquipa Kivora`,
    );
    await audit(this.pool, { action: "auth.email_code_sent", actorId: userId, requestId, metadata: {} });
    return { alreadyVerified: false };
  }

  /** Confirma o código. Máximo de 5 tentativas por código. */
  async verify(userId: string, code: string, requestId: string): Promise<void> {
    const outcome = await tx(this.pool, async (c): Promise<"ok" | "invalid" | "expired" | "locked" | "none"> => {
      const row = await one<{ hash: string; expired: boolean; attempts: number }>(
        c,
        `SELECT code_hash AS hash, (expires_at < now()) AS expired, attempts FROM email_verifications WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      if (!row) return "none";
      if (row.attempts >= MAX_ATTEMPTS) return "locked";
      if (row.expired) return "expired";
      const a = Buffer.from(row.hash, "hex");
      const b = hashCode(userId, code);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        await sql(c, "UPDATE email_verifications SET attempts = attempts + 1 WHERE user_id = $1", [userId]);
        return "invalid";
      }
      await sql(c, "UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1", [userId]);
      await sql(c, "DELETE FROM email_verifications WHERE user_id = $1", [userId]);
      await audit(c, { action: "auth.email_verified", actorId: userId, requestId, metadata: {} });
      return "ok";
    });
    if (outcome === "ok") return;
    if (outcome === "locked") throw new ApiException(API_ERROR_CODE.RATE_LIMITED, { retryAfterSeconds: COOLDOWN_SECONDS });
    throw bad(outcome === "expired" ? "expiredCode" : "invalidCode");
  }
}
