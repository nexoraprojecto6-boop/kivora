import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE } from "@kivora/shared";
import type { SessionSummary } from "@kivora/shared";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "@kivora/validation";
import { ApiException } from "../common/api-error.js";
import type { AppConfig } from "../config/env.js";
import { APP_CONFIG, AUTH_REPOSITORY } from "../config/tokens.js";
import type { AuthRepository } from "./auth.repository.js";
import { toPublicUser, type PublicUser } from "./auth.types.js";
import { PasswordHasher } from "./password.service.js";
import { FixedWindowRateLimiter } from "./rate-limiter.js";
import { SessionService } from "./session.service.js";

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RequestContext {
  ip: string;
  requestId: string;
}

/**
 * Marcador de versão dos textos legais. Os Termos e a Política de Privacidade
 * ainda não existem como documentos versionados (ver docs/compliance).
 */
export const LEGAL_DOCUMENT_VERSION_PENDING = "pending-definition";

/** Falhas por email e janelas. Os limites por IP vêm da configuração (LOGIN_IP_LIMIT, REGISTER_IP_LIMIT). */
export const LOGIN_LIMITS = { perEmailFailures: 5, windowMs: 15 * 60_000 } as const;
export const REGISTER_LIMITS = { windowMs: 60 * 60_000 } as const;

@Injectable()
export class AuthService {
  private readonly loginIpLimiter: FixedWindowRateLimiter;
  private readonly loginEmailFailures = new FixedWindowRateLimiter(
    LOGIN_LIMITS.perEmailFailures,
    LOGIN_LIMITS.windowMs,
  );
  private readonly registerIpLimiter: FixedWindowRateLimiter;
  private readonly passwordChangeFailures = new FixedWindowRateLimiter(
    LOGIN_LIMITS.perEmailFailures,
    LOGIN_LIMITS.windowMs,
  );
  private dummyHash: Promise<string> | undefined;

  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {
    this.loginIpLimiter = new FixedWindowRateLimiter(config.loginIpLimit, LOGIN_LIMITS.windowMs);
    this.registerIpLimiter = new FixedWindowRateLimiter(config.registerIpLimit, REGISTER_LIMITS.windowMs);
  }

  async register(input: RegisterInput, ctx: RequestContext): Promise<PublicUser> {
    if (!this.config.registrationEnabled) {
      throw new ApiException(API_ERROR_CODE.FEATURE_DISABLED);
    }
    const limit = this.registerIpLimiter.consume(ctx.ip);
    if (!limit.allowed) {
      throw new ApiException(API_ERROR_CODE.RATE_LIMITED, { retryAfterSeconds: limit.retryAfterSeconds });
    }

    const passwordHash = await this.hasher.hash(input.password);
    const acceptedAt = new Date();
    const user = await this.repo.createUserWithCredential(
      { email: input.email, fullName: input.fullName, countryOfResidence: input.countryOfResidence },
      passwordHash,
      [
        { documentType: "terms", documentVersion: LEGAL_DOCUMENT_VERSION_PENDING, acceptedAt },
        { documentType: "privacy", documentVersion: LEGAL_DOCUMENT_VERSION_PENDING, acceptedAt },
      ],
      input.ref ? { code: input.ref, ipHash: ctx.ip ? createHash("sha256").update(`${process.env["REFERRAL_IP_SALT"] ?? "kivora-ref"}|${ctx.ip}`).digest("hex") : null } : undefined,
    );
    if (!user) {
      // Limitação conhecida: sem verificação de email (decisão 6) não é possível
      // esconder que o email já existe. O limitador reduz a enumeração em massa.
      await this.repo.appendAudit({
        action: "auth.register",
        actorUserId: null,
        requestId: ctx.requestId,
        outcome: "failure",
        metadata: { reason: "email_in_use" },
      });
      throw new ApiException(API_ERROR_CODE.CONFLICT);
    }
    await this.repo.appendAudit({
      action: "auth.register",
      actorUserId: user.id,
      requestId: ctx.requestId,
      outcome: "success",
    });
    return toPublicUser(user);
  }

  /** Cria a conta e abre sessão, para o utilizador seguir logo para a verificação (email e documentos). */
  async registerWithSession(
    input: RegisterInput,
    ctx: RequestContext,
  ): Promise<{ user: PublicUser; token: string; expiresAt: Date }> {
    const user = await this.register(input, ctx);
    const { token, expiresAt } = await this.sessions.create(user.id);
    return { user, token, expiresAt };
  }

  async login(
    input: LoginInput,
    ctx: RequestContext,
  ): Promise<{ user: PublicUser; token: string; expiresAt: Date }> {
    const ipCheck = this.loginIpLimiter.consume(ctx.ip);
    const emailCheck = this.loginEmailFailures.isBlocked(input.email);
    if (!ipCheck.allowed || !emailCheck.allowed) {
      await this.repo.appendAudit({
        action: "auth.login",
        actorUserId: null,
        requestId: ctx.requestId,
        outcome: "failure",
        metadata: { reason: "rate_limited" },
      });
      throw new ApiException(API_ERROR_CODE.RATE_LIMITED, {
        retryAfterSeconds: Math.max(ipCheck.retryAfterSeconds, emailCheck.retryAfterSeconds),
      });
    }

    const user = await this.repo.findUserByEmail(input.email);
    const storedHash = user ? await this.repo.getPasswordHash(user.id) : null;
    // Faz sempre uma verificação de hash, mesmo sem conta, para o tempo de resposta
    // não revelar se o email existe.
    const passwordOk = await this.hasher.verify(input.password, storedHash ?? (await this.getDummyHash()));

    if (!user || !storedHash || !passwordOk || user.status === "suspended") {
      this.loginEmailFailures.consume(input.email);
      await this.repo.appendAudit({
        action: "auth.login",
        actorUserId: user?.id ?? null,
        requestId: ctx.requestId,
        outcome: "failure",
        metadata: { reason: "invalid_credentials" },
      });
      // Resposta idêntica para email inexistente, palavra-passe errada e conta suspensa.
      throw new ApiException(API_ERROR_CODE.UNAUTHENTICATED);
    }

    const { token, expiresAt } = await this.sessions.create(user.id);
    await this.repo.appendAudit({
      action: "auth.login",
      actorUserId: user.id,
      requestId: ctx.requestId,
      outcome: "success",
    });
    return { user: toPublicUser(user), token, expiresAt };
  }

  async logout(token: unknown, ctx: RequestContext): Promise<void> {
    const resolved = await this.sessions.resolve(token);
    await this.sessions.revoke(token);
    if (resolved) {
      await this.repo.appendAudit({
        action: "auth.logout",
        actorUserId: resolved.user.id,
        requestId: ctx.requestId,
        outcome: "success",
      });
    }
  }

  /** Sessões abertas do próprio utilizador. Nunca devolve tokens nem hashes. */
  async listSessions(userId: string, currentTokenHash: string): Promise<SessionSummary[]> {
    const sessions = await this.repo.listSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: s.tokenHash === currentTokenHash,
    }));
  }

  /** Termina uma sessão do próprio utilizador. Inexistente ou de outra pessoa: NOT_FOUND. */
  async revokeSession(userId: string, sessionId: string, ctx: RequestContext): Promise<void> {
    const found = UUID_FORMAT.test(sessionId) && (await this.repo.deleteSession(userId, sessionId));
    if (!found) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    await this.repo.appendAudit({
      action: "auth.session_revoke",
      actorUserId: userId,
      requestId: ctx.requestId,
      outcome: "success",
    });
  }

  async revokeOtherSessions(userId: string, currentTokenHash: string, ctx: RequestContext): Promise<number> {
    const revoked = await this.repo.deleteOtherSessions(userId, currentTokenHash);
    await this.repo.appendAudit({
      action: "auth.sessions_revoke_others",
      actorUserId: userId,
      requestId: ctx.requestId,
      outcome: "success",
      metadata: { revoked },
    });
    return revoked;
  }

  /**
   * Altera a palavra-passe. Exige a actual (limite de 5 falhas em 15 minutos) e
   * termina todas as outras sessões, para que quem tivesse acesso perca-o.
   */
  async changePassword(
    userId: string,
    currentTokenHash: string,
    input: ChangePasswordInput,
    ctx: RequestContext,
  ): Promise<number> {
    const blocked = this.passwordChangeFailures.isBlocked(userId);
    if (!blocked.allowed) {
      throw new ApiException(API_ERROR_CODE.RATE_LIMITED, { retryAfterSeconds: blocked.retryAfterSeconds });
    }
    const storedHash = await this.repo.getPasswordHash(userId);
    const ok = storedHash !== null && (await this.hasher.verify(input.currentPassword, storedHash));
    if (!ok) {
      this.passwordChangeFailures.consume(userId);
      await this.repo.appendAudit({
        action: "auth.password_change",
        actorUserId: userId,
        requestId: ctx.requestId,
        outcome: "failure",
        metadata: { reason: "invalid_current_password" },
      });
      throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, {
        fieldErrors: [{ field: "currentPassword", code: "invalidCredentials" }],
      });
    }
    const newHash = await this.hasher.hash(input.newPassword);
    const revoked = await this.repo.replacePasswordAndRevokeOtherSessions(userId, newHash, currentTokenHash);
    await this.repo.appendAudit({
      action: "auth.password_change",
      actorUserId: userId,
      requestId: ctx.requestId,
      outcome: "success",
      metadata: { revokedSessions: revoked },
    });
    return revoked;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomBytes(16).toString("hex"));
    return this.dummyHash;
  }
}
