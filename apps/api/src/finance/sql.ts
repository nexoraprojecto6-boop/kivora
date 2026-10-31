import { randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export type Db = Pool | PoolClient;

export async function sql<R extends QueryResultRow = QueryResultRow>(db: Db, text: string, params: unknown[] = []): Promise<R[]> {
  return (await (db as Pool).query<R>(text, params)).rows;
}

export async function one<R extends QueryResultRow = QueryResultRow>(db: Db, text: string, params: unknown[] = []): Promise<R | undefined> {
  return (await sql<R>(db, text, params))[0];
}

/** Executa numa transacção. Em caso de erro faz ROLLBACK e volta a lançar. */
export async function tx<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // a ligação pode já estar fechada
    }
    throw error;
  } finally {
    client.release();
  }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Referência legível para o cliente e para a administração (sem caracteres ambíguos). */
export function newReference(prefix: "D" | "W" | "S"): string {
  let s = "";
  for (const b of randomBytes(8)) s += ALPHABET.charAt(b % ALPHABET.length);
  return `KV${prefix}-${s}`;
}

export interface Ctx {
  /** Quem está a agir (utilizador ou membro da equipa). */
  actorId: string;
  requestId: string;
}

export async function audit(
  db: Db,
  a: { action: string; actorId: string | null; requestId: string; outcome?: "SUCCESS" | "FAILURE"; metadata?: Record<string, string | number | boolean> },
): Promise<void> {
  await sql(
    db,
    "INSERT INTO audit_events (action, actor_user_id, request_id, outcome, metadata) VALUES ($1, $2, $3, $4, $5)",
    [a.action, a.actorId, a.requestId, a.outcome ?? "SUCCESS", a.metadata ? JSON.stringify(a.metadata) : null],
  );
}

export async function notify(db: Db, userId: string, type: string, params: Record<string, string | number> = {}): Promise<void> {
  await sql(db, "INSERT INTO notifications (user_id, type, params) VALUES ($1, $2, $3)", [userId, type, JSON.stringify(params)]);
}

/* ---------- Livro contabilístico (só de acréscimo) ---------- */

export type LedgerKind =
  | "DEPOSIT_CONFIRMED"
  | "WITHDRAWAL_RESERVE"
  | "WITHDRAWAL_RELEASE"
  | "WITHDRAWAL_PAID"
  | "SUBSCRIPTION_RESERVE"
  | "SUBSCRIPTION_RELEASE"
  | "REFERRAL_COMMISSION"
  | "PLAN_EARNINGS";
export interface Leg {
  bucket: "AVAILABLE" | "RESERVED";
  amount: number;
}

/** Serializa as operações de saldo de um utilizador dentro da transacção. */
export async function lockUser(client: PoolClient, userId: string): Promise<void> {
  await sql(client, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [userId]);
}

export async function getBalance(db: Db, userId: string): Promise<{ available: number; reserved: number }> {
  const row = await one<{ available: number; reserved: number }>(
    db,
    `SELECT COALESCE(SUM(amount_minor) FILTER (WHERE bucket = 'AVAILABLE'), 0)::float8 AS available,
            COALESCE(SUM(amount_minor) FILTER (WHERE bucket = 'RESERVED'), 0)::float8 AS reserved
       FROM ledger_entries WHERE user_id = $1`,
    [userId],
  );
  return { available: row?.available ?? 0, reserved: row?.reserved ?? 0 };
}

export async function post(
  client: PoolClient,
  e: { userId: string; currency: string; kind: LedgerKind; refType: "DEPOSIT" | "WITHDRAWAL" | "SUBSCRIPTION" | "REFERRAL"; refId: string; actorId: string | null; legs: Leg[] },
): Promise<void> {
  const groupId = randomUUID();
  for (const leg of e.legs) {
    await sql(
      client,
      `INSERT INTO ledger_entries (user_id, bucket, amount_minor, currency, kind, ref_type, ref_id, group_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [e.userId, leg.bucket, leg.amount, e.currency, e.kind, e.refType, e.refId, groupId, e.actorId],
    );
  }
}

export const reserveLegs = (amount: number): Leg[] => [
  { bucket: "AVAILABLE", amount: -amount },
  { bucket: "RESERVED", amount },
];
export const releaseLegs = (amount: number): Leg[] => [
  { bucket: "AVAILABLE", amount },
  { bucket: "RESERVED", amount: -amount },
];
