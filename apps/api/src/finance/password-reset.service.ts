import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE } from "@kivora/shared";
import type { Pool } from "pg";
import { PasswordHasher } from "../auth/password.service.js";
import { FixedWindowRateLimiter } from "../auth/rate-limiter.js";
import { ApiException } from "../common/api-error.js";
import { PG_POOL } from "./finance.config.js";
import { Mailer } from "./mailer.service.js";
import { audit, one, sql, tx } from "./sql.js";

const TTL_MINUTES = 15;
const COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const hashCode = (userId: string, code: string): Buffer => createHash("sha256").update(`${userId}:reset:${code}`).digest();
const bad = (code: string): ApiException => new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "code", code }] });

/**
 * Recuperação de palavra-passe: 1) pede-se o código por email; 2) envia-se email + código + nova palavra-passe.
 * Não revela se o email existe (a resposta de "forgot" é sempre a mesma) e, ao concluir, termina todas as sessões.
 */
@Injectable()
export class PasswordResetService {
  /** Limite por IP para pedidos de código: 5 em 15 minutos. */
  private readonly ipLimiter = new FixedWindowRateLimiter(5, 15 * 60_000);
  /** Limite por IP para tentativas de redefinição: 15 em 15 minutos. */
  private readonly resetIpLimiter = new FixedWindowRateLimiter(15, 15 * 60_000);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly mailer: Mailer,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Envia um código de 6 dígitos para o email, se existir uma conta ativa. Resposta igual em todos os casos. */
  async send(email: string, ip: string, requestId: string): Promise<void> {
    const limit = this.ipLimiter.consume(ip);
    if (!limit.allowed) throw new ApiException(API_ERROR_CODE.RATE_LIMITED, { retryAfterSeconds: limit.retryAfterSeconds });

    const user = await one<{ id: string; fullName: string; status: string }>(
      this.pool,
      `SELECT id, full_name AS "fullName", status FROM users WHERE email = $1`,
      [email],
    );
    if (!user || user.status === "SUSPENDED") return;

    const prev = await one<{ wait: number }>(
      this.pool,
      `SELECT GREATEST(0, CEIL($2 - EXTRACT(EPOCH FROM (now() - sent_at))))::int AS wait FROM password_resets WHERE user_id = $1`,
      [user.id, COOLDOWN_SECONDS],
    );
    if (prev && prev.wait > 0) return; // dentro do intervalo de 60 s: não reenvia (e não revela nada)

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      await this.mailer.send(
        email,
        "Kivora — recuperar palavra-passe",
        `Olá ${user.fullName},\n\nO seu código para redefinir a palavra-passe é: ${code}\n\nÉ válido durante ${TTL_MINUTES} minutos. Se não pediu este código, ignore esta mensagem: a sua palavra-passe não será alterada.\n\nEquipa Kivora`,
      );
    } catch {
      // O Mailer já registou o motivo no log. Não se revela ao cliente, para não confirmar que a conta existe.
      return;
    }
    await sql(
      this.pool,
      `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts, sent_at)
       VALUES ($1, $2, now() + make_interval(mins => $3), 0, now())
       ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = now()`,
      [user.id, hashCode(user.id, code).toString("hex"), TTL_MINUTES],
    );
    await audit(this.pool, { action: "auth.password_reset_code_sent", actorId: user.id, requestId, metadata: {} });
  }

  /** Confirma o código e define a nova palavra-passe. Máximo de 5 tentativas por código. */
  async reset(email: string, code: string, newPassword: string, ip: string, requestId: string): Promise<void> {
    const limit = this.resetIpLimiter.consume(ip);
    if (!limit.allowed) throw new ApiException(API_ERROR_CODE.RATE_LIMITED, { retryAfterSeconds: limit.retryAfterSeconds });

    const user = await one<{ id: string }>(this.pool, `SELECT id FROM users WHERE email = $1`, [email]);
    if (!user) throw bad("invalidCode");

    const newHash = await this.hasher.hash(newPassword);
    const outcome = await tx(this.pool, async (c): Promise<"ok" | "invalid" | "expired" | "locked" | "none"> => {
      const row = await one<{ hash: string; expired: boolean; attempts: number }>(
        c,
        `SELECT code_hash AS hash, (expires_at < now()) AS expired, attempts FROM password_resets WHERE user_id = $1 FOR UPDATE`,
        [user.id],
      );
      if (!row) return "none";
      if (row.attempts >= MAX_ATTEMPTS) return "locked";
      if (row.expired) return "expired";
      const a = Buffer.from(row.hash, "hex");
      const b = hashCode(user.id, code);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        await sql(c, "UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = $1", [user.id]);
        return "invalid";
      }
      await sql(c, "UPDATE credentials SET password_hash = $2, updated_at = now() WHERE user_id = $1", [user.id, newHash]);
      await sql(c, "DELETE FROM sessions WHERE user_id = $1", [user.id]);
      await sql(c, "DELETE FROM password_resets WHERE user_id = $1", [user.id]);
      await audit(c, { action: "auth.password_reset", actorId: user.id, requestId, metadata: {} });
      return "ok";
    });
    if (outcome === "ok") return;
    if (outcome === "locked") throw new ApiException(API_ERROR_CODE.RATE_LIMITED, { retryAfterSeconds: COOLDOWN_SECONDS });
    throw bad(outcome === "expired" ? "expiredCode" : "invalidCode");
  }
}
