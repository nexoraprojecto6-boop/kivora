import type { Pool } from "pg";
import type { UserAccountStatus } from "@kivora/shared";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { AuditEventInput, NewConsent, NewUser, SessionRecord, UserRecord } from "../auth/auth.types.js";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  country_of_residence: string;
  status: string;
  email_verified: boolean;
  created_at: Date;
}

const USER_COLUMNS = "id, email, full_name, country_of_residence, status, email_verified, created_at";
const CLEANUP_INTERVAL_MS = 60 * 60_000;

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    countryOfResidence: row.country_of_residence,
    status: row.status.toLowerCase() as UserAccountStatus,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
  };
}

/** Implementação PostgreSQL do acesso a dados da autenticação (consultas parametrizadas, sem concatenação). */
export class PgAuthRepository implements AuthRepository {
  private lastCleanup = 0;

  constructor(private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const r = await this.pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
    return r.rows[0] ? toUser(r.rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const r = await this.pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
    return r.rows[0] ? toUser(r.rows[0]) : null;
  }

  async createUserWithCredential(
    user: NewUser,
    passwordHash: string,
    consents: readonly NewConsent[],
    referral?: { code: string; ipHash: string | null },
  ): Promise<UserRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // O índice único decide em caso de pedidos simultâneos com o mesmo email.
      const inserted = await client.query<UserRow>(
        `INSERT INTO users (email, full_name, country_of_residence)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING
         RETURNING ${USER_COLUMNS}`,
        [user.email, user.fullName, user.countryOfResidence],
      );
      const row = inserted.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query("INSERT INTO credentials (user_id, password_hash) VALUES ($1, $2)", [row.id, passwordHash]);
      for (const c of consents) {
        await client.query(
          `INSERT INTO consent_records (user_id, document_type, document_version, accepted_at)
           VALUES ($1, $2::consent_document_type, $3, $4)`,
          [row.id, c.documentType.toUpperCase(), c.documentVersion, c.acceptedAt],
        );
      }
      if (referral) {
        // Mesma transacção do registo. Sem erro se o código não existir, o convidante não estiver activo ou o convite estiver desligado.
        // Vários registos do mesmo IP no mesmo convidante ficam FLAGGED (retidos para análise).
        await client.query(
          `INSERT INTO referrals (referrer_id, referred_id, signup_ip_hash, status)
           SELECT rc.user_id, $2, $3::text,
                  CASE WHEN $3::text IS NOT NULL AND (SELECT count(*) FROM referrals x WHERE x.referrer_id = rc.user_id AND x.signup_ip_hash = $3::text) >= (SELECT max_same_ip FROM referral_settings)
                       THEN 'FLAGGED' ELSE 'ACTIVE' END
             FROM referral_codes rc JOIN users u ON u.id = rc.user_id
            WHERE rc.code = $1 AND rc.user_id <> $2 AND u.status = 'ACTIVE' AND (SELECT enabled FROM referral_settings)
           ON CONFLICT DO NOTHING`,
          [referral.code, row.id, referral.ipHash],
        );
      }
      await client.query("COMMIT");
      return toUser(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    const r = await this.pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM credentials WHERE user_id = $1",
      [userId],
    );
    return r.rows[0]?.password_hash ?? null;
  }

  async createSession(s: Omit<SessionRecord, "id" | "createdAt">): Promise<SessionRecord> {
    await this.cleanupExpiredSessions();
    const r = await this.pool.query<{ id: string; created_at: Date }>(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id, created_at",
      [s.userId, s.tokenHash, s.expiresAt],
    );
    const row = r.rows[0]!;
    return { id: row.id, userId: s.userId, tokenHash: s.tokenHash, createdAt: row.created_at, expiresAt: s.expiresAt };
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const r = await this.pool.query<{ id: string; user_id: string; token_hash: string; created_at: Date; expires_at: Date }>(
      "SELECT id, user_id, token_hash, created_at, expires_at FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
    const row = r.rows[0];
    return row
      ? { id: row.id, userId: row.user_id, tokenHash: row.token_hash, createdAt: row.created_at, expiresAt: row.expires_at }
      : null;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }

  async appendAudit(event: AuditEventInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (action, actor_user_id, request_id, outcome, metadata)
       VALUES ($1, $2, $3, $4::audit_outcome, $5)`,
      [
        event.action,
        event.actorUserId,
        event.requestId,
        event.outcome.toUpperCase(),
        event.metadata ? JSON.stringify(event.metadata) : null,
      ],
    );
  }

  async listSessions(userId: string): Promise<SessionRecord[]> {
    const r = await this.pool.query<{ id: string; user_id: string; token_hash: string; created_at: Date; expires_at: Date }>(
      `SELECT id, user_id, token_hash, created_at, expires_at FROM sessions
       WHERE user_id = $1 AND expires_at > now() ORDER BY created_at DESC`,
      [userId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    // O filtro por utilizador impede terminar sessões de outras pessoas.
    const r = await this.pool.query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [sessionId, userId]);
    return (r.rowCount ?? 0) > 0;
  }

  async deleteOtherSessions(userId: string, keepTokenHash: string): Promise<number> {
    const r = await this.pool.query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [userId, keepTokenHash]);
    return r.rowCount ?? 0;
  }

  async replacePasswordAndRevokeOtherSessions(userId: string, passwordHash: string, keepTokenHash: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE credentials SET password_hash = $2, updated_at = now() WHERE user_id = $1", [userId, passwordHash]);
      const r = await client.query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [userId, keepTokenHash]);
      await client.query("COMMIT");
      return r.rowCount ?? 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Remove sessões expiradas, no máximo uma vez por hora por instância. */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    await this.pool.query("DELETE FROM sessions WHERE expires_at < now()");
  }
}
