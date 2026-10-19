import { randomUUID } from "node:crypto";
import type { AuthRepository } from "./auth.repository.js";
import type {
  AuditEventInput,
  NewConsent,
  NewUser,
  SessionRecord,
  UserRecord,
} from "./auth.types.js";

/** Armazenamento em memória: só para desenvolvimento e testes. Perde tudo ao reiniciar. */
export class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, UserRecord>();
  readonly credentials = new Map<string, string>();
  readonly sessions = new Map<string, SessionRecord>();
  readonly consents: Array<NewConsent & { userId: string }> = [];
  readonly audit: AuditEventInput[] = [];

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) if (u.email === email) return u;
    return null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async createUserWithCredential(
    user: NewUser,
    passwordHash: string,
    consents: readonly NewConsent[],
  ): Promise<UserRecord | null> {
    if (await this.findUserByEmail(user.email)) return null;
    const record: UserRecord = {
      id: randomUUID(),
      email: user.email,
      fullName: user.fullName,
      countryOfResidence: user.countryOfResidence,
      status: "active",
      emailVerified: false,
      createdAt: new Date(),
    };
    this.users.set(record.id, record);
    this.credentials.set(record.id, passwordHash);
    for (const c of consents) this.consents.push({ ...c, userId: record.id });
    return record;
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    return this.credentials.get(userId) ?? null;
  }

  async createSession(s: Omit<SessionRecord, "id" | "createdAt">): Promise<SessionRecord> {
    const record: SessionRecord = { ...s, id: randomUUID(), createdAt: new Date() };
    this.sessions.set(record.tokenHash, record);
    return record;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async appendAudit(event: AuditEventInput): Promise<void> {
    this.audit.push(event);
  }
}
