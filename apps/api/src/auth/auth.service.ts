import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE } from "@kivora/shared";
import type { LoginInput, RegisterInput } from "@kivora/validation";
import { ApiException } from "../common/api-error.js";
import type { AppConfig } from "../config/env.js";
import { APP_CONFIG, AUTH_REPOSITORY } from "../config/tokens.js";
import type { AuthRepository } from "./auth.repository.js";
import { toPublicUser, type PublicUser } from "./auth.types.js";
import { PasswordHasher } from "./password.service.js";
import { FixedWindowRateLimiter } from "./rate-limiter.js";
import { SessionService } from "./session.service.js";

export interface RequestContext {
  ip: string;
  requestId: string;
}

/**
 * Marcador de versão dos textos legais. Os Termos e a Política de Privacidade
 * ainda não existem como documentos versionados (ver docs/compliance).
 */
export const LEGAL_DOCUMENT_VERSION_PENDING = "pending-definition";

export const LOGIN_LIMITS = { perIp: 10, perEmailFailures: 5, windowMs: 15 * 60_000 } as const;
export const REGISTER_LIMITS = { perIp: 5, windowMs: 60 * 60_000 } as const;

@Injectable()
export class AuthService {
  private readonly loginIpLimiter = new FixedWindowRateLimiter(
    LOGIN_LIMITS.perIp,
    LOGIN_LIMITS.windowMs,
  );
  private readonly loginEmailFailures = new FixedWindowRateLimiter(
    LOGIN_LIMITS.perEmailFailures,
    LOGIN_LIMITS.windowMs,
  );
  private readonly registerIpLimiter = new FixedWindowRateLimiter(
    REGISTER_LIMITS.perIp,
    REGISTER_LIMITS.windowMs,
  );
  private dummyHash: Promise<string> | undefined;

  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

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

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomBytes(16).toString("hex"));
    return this.dummyHash;
  }
}
