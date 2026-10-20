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
    // Verificação e inserção sem pausas assíncronas entre si: atómico em Node.
    for (const u of this.users.values()) if (u.email === user.email) return null;
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

  async listSessions(userId: string): Promise<SessionRecord[]> {
    const now = Date.now();
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId && s.expiresAt.getTime() > now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    for (const [key, s] of this.sessions) {
      if (s.id === sessionId && s.userId === userId) {
        this.sessions.delete(key);
        return true;
      }
    }
    return false;
  }

  async deleteOtherSessions(userId: string, keepTokenHash: string): Promise<number> {
    let n = 0;
    for (const [key, s] of this.sessions) {
      if (s.userId === userId && key !== keepTokenHash) {
        this.sessions.delete(key);
        n += 1;
      }
    }
    return n;
  }

  async replacePasswordAndRevokeOtherSessions(userId: string, passwordHash: string, keepTokenHash: string): Promise<number> {
    this.credentials.set(userId, passwordHash);
    return this.deleteOtherSessions(userId, keepTokenHash);
  }
}
