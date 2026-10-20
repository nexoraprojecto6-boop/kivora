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

  /** Sessões não expiradas do utilizador, da mais recente para a mais antiga. */
  listSessions(userId: string): Promise<SessionRecord[]>;
  /** Termina uma sessão, só se pertencer ao utilizador. Devolve se existia. */
  deleteSession(userId: string, sessionId: string): Promise<boolean>;
  /** Termina todas as sessões do utilizador excepto a indicada. Devolve quantas terminou. */
  deleteOtherSessions(userId: string, keepTokenHash: string): Promise<number>;
  /** Troca a palavra-passe e termina as outras sessões, de forma atómica. Devolve quantas terminou. */
  replacePasswordAndRevokeOtherSessions(userId: string, passwordHash: string, keepTokenHash: string): Promise<number>;
}
