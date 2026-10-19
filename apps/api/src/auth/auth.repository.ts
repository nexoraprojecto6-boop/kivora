import type {
  AuditEventInput,
  NewConsent,
  NewUser,
  SessionRecord,
  UserRecord,
} from "./auth.types.js";

/**
 * Acesso a dados da autenticação. A implementação definitiva usa PostgreSQL
 * (Prisma). A implementação em memória serve apenas para desenvolvimento e testes.
 */
export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  /** Devolve null se o email já existir. Cria utilizador, credencial e consentimentos de forma atómica. */
  createUserWithCredential(
    user: NewUser,
    passwordHash: string,
    consents: readonly NewConsent[],
  ): Promise<UserRecord | null>;
  getPasswordHash(userId: string): Promise<string | null>;
  createSession(session: Omit<SessionRecord, "id" | "createdAt">): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  appendAudit(event: AuditEventInput): Promise<void>;
}
