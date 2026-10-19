import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, AUTH_REPOSITORY } from "../config/tokens.js";
import type { AppConfig } from "../config/env.js";
import type { AuthRepository } from "./auth.repository.js";
import type { SessionRecord, UserRecord } from "./auth.types.js";

export const SESSION_COOKIE_NAME = "kivora_session";
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Cria uma sessão e devolve o token em claro (só existe no cookie; na base guarda-se o hash). */
  async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url"); // 43 caracteres
    const expiresAt = new Date(Date.now() + this.config.sessionTtlHours * 3_600_000);
    await this.repo.createSession({ userId, tokenHash: hashSessionToken(token), expiresAt });
    return { token, expiresAt };
  }

  /** Devolve o utilizador da sessão, ou null se o token for inválido, expirado ou a conta estiver suspensa. */
  async resolve(token: unknown): Promise<{ user: UserRecord; session: SessionRecord } | null> {
    if (typeof token !== "string" || !TOKEN_FORMAT.test(token)) return null;
    const tokenHash = hashSessionToken(token);
    const session = await this.repo.findSessionByTokenHash(tokenHash);
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.repo.deleteSessionByTokenHash(tokenHash);
      return null;
    }
    const user = await this.repo.findUserById(session.userId);
    if (!user || user.status === "suspended") return null;
    return { user, session };
  }

  async revoke(token: unknown): Promise<void> {
    if (typeof token !== "string" || !TOKEN_FORMAT.test(token)) return;
    await this.repo.deleteSessionByTokenHash(hashSessionToken(token));
  }
}
