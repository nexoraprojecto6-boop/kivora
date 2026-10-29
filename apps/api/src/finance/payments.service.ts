import { Inject, Injectable } from "@nestjs/common";
import {
  API_ERROR_CODE,
  type AdminDepositDto,
  type AdminWithdrawalDto,
  type DepositDto,
  type PaymentMethodDto,
  type TransactionDto,
  type KycStatus,
  type WalletDto,
  type WithdrawalDto,
} from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { FINANCE_CONFIG, FinanceGate, PG_POOL, type FinanceConfig } from "./finance.config.js";
import {
  audit, getBalance, lockUser, newReference, notify, one, post, releaseLegs, reserveLegs, sql, tx, type Ctx,
} from "./sql.js";

const METHOD_COLS = `m.id, m.kind, m.name, m.instructions, m.min_minor::float8 AS "minMinor", m.max_minor::float8 AS "maxMinor",
  m.fee_minor::float8 AS "feeMinor", m.fee_note AS "feeNote", m.enabled, m.sort_order AS "sortOrder"`;
const DEP_COLS = `d.id, d.reference, d.amount_minor::float8 AS "amountMinor", d.currency, d.status, d.user_note AS "userNote",
  d.decision_note AS "decisionNote", d.created_at AS "createdAt", d.decided_at AS "decidedAt", m.id AS "methodId", m.name AS "methodName", m.instructions`;
const WD_COLS = `w.id, w.reference, w.amount_minor::float8 AS "amountMinor", w.currency, w.status, w.destination,
  w.decision_note AS "decisionNote", w.created_at AS "createdAt", w.decided_at AS "decidedAt", m.id AS "methodId", m.name AS "methodName"`;
const WITH_USER = `, u.id AS "userId", u.email AS "userEmail", u.full_name AS "userName"`;

export function checkRange(amount: number, min: number | null, max: number | null): void {
  if (min !== null && amount < min) throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "amountMinor", code: "belowMinimum" }] });
  if (max !== null && amount > max) throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "amountMinor", code: "aboveMaximum" }] });
}

const notFound = (): ApiException => new ApiException(API_ERROR_CODE.NOT_FOUND);

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(FINANCE_CONFIG) private readonly cfg: FinanceConfig,
    private readonly gate: FinanceGate,
  ) {}

  /* ---------- Carteira e métodos ---------- */

  async wallet(userId: string): Promise<WalletDto> {
    const b = await getBalance(this.pool, userId);
    const v = await one<{ status: KycStatus }>(
      this.pool,
      "SELECT status FROM verification_submissions WHERE user_id = $1 ORDER BY (status = 'APPROVED') DESC, created_at DESC LIMIT 1",
      [userId],
    );
    return {
      currency: this.cfg.currency,
      available: b.available,
      reserved: b.reserved,
      total: b.available + b.reserved,
      financeEnabled: this.cfg.enabled,
      requireVerification: this.cfg.requireKyc,
      verificationStatus: v?.status ?? "NONE",
    };
  }

  methods(kind: "DEPOSIT" | "WITHDRAWAL" | null): Promise<PaymentMethodDto[]> {
    return sql<PaymentMethodDto>(
      this.pool,
      `SELECT ${METHOD_COLS} FROM payment_methods m WHERE m.enabled AND ($1::text IS NULL OR m.kind = $1) ORDER BY m.sort_order, m.name`,
      [kind],
    );
  }

  async transactions(userId: string, f: { kind: string | null; q: string | null; cursor: string | null; limit: number }): Promise<{ items: TransactionDto[]; nextCursor: string | null }> {
    const [cAt, cId] = (f.cursor ?? "").split("|");
    const rows = await sql<TransactionDto>(
      this.pool,
      `SELECT * FROM (
         SELECT d.id, 'DEPOSIT' AS kind, d.amount_minor::float8 AS "amountMinor", d.status, d.reference, d.created_at AS "createdAt" FROM deposits d WHERE d.user_id = $1
         UNION ALL
         SELECT w.id, 'WITHDRAWAL', w.amount_minor::float8, w.status, w.reference, w.created_at FROM withdrawals w WHERE w.user_id = $1
         UNION ALL
         SELECT s.id, 'SUBSCRIPTION', s.amount_minor::float8, s.status, s.reference, s.created_at FROM plan_subscriptions s WHERE s.user_id = $1
       ) t
       WHERE ($2::text IS NULL OR t.kind = $2)
         AND ($3::text IS NULL OR t.reference ILIKE $3)
         AND ($4::timestamptz IS NULL OR (t."createdAt", t.id) < ($4::timestamptz, $5::uuid))
       ORDER BY t."createdAt" DESC, t.id DESC LIMIT $6`,
      [userId, f.kind, f.q ? `%${f.q.replace(/[\\%_]/g, "\\$&")}%` : null, cAt ?? null, cId ?? null, f.limit + 1],
    );
    const items = rows.slice(0, f.limit);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > f.limit && last ? `${new Date(last.createdAt).toISOString()}|${last.id}` : null };
  }

  /* ---------- Depósitos (cliente) ---------- */

  private async depositById(id: string, userId: string | null): Promise<DepositDto | undefined> {
    return one<DepositDto>(this.pool, `SELECT ${DEP_COLS} FROM deposits d JOIN payment_methods m ON m.id = d.method_id WHERE d.id = $1 AND ($2::uuid IS NULL OR d.user_id = $2)`, [id, userId]);
  }

  async createDeposit(userId: string, input: { methodId: string; amountMinor: number; note?: string | undefined }, idem: string | null, requestId: string): Promise<DepositDto> {
    await this.gate.check(userId);
    const m = await one<{ minMinor: number | null; maxMinor: number | null }>(
      this.pool,
      `SELECT min_minor::float8 AS "minMinor", max_minor::float8 AS "maxMinor" FROM payment_methods WHERE id = $1 AND kind = 'DEPOSIT' AND enabled`,
      [input.methodId],
    );
    if (!m) throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "methodId", code: "invalid" }] });
    checkRange(input.amountMinor, m.minMinor, m.maxMinor);
    if (idem) {
      const ex = await one<{ id: string; methodId: string; amountMinor: number }>(
        this.pool,
        `SELECT id, method_id AS "methodId", amount_minor::float8 AS "amountMinor" FROM deposits WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, idem],
      );
      if (ex) {
        if (ex.methodId !== input.methodId || ex.amountMinor !== input.amountMinor) throw new ApiException(API_ERROR_CODE.IDEMPOTENCY_CONFLICT);
        const same = await this.depositById(ex.id, userId);
        if (same) return same;
      }
    }
    const open = await one<{ n: number }>(this.pool, "SELECT count(*)::int AS n FROM deposits WHERE user_id = $1 AND status = 'PENDING'", [userId]);
    if ((open?.n ?? 0) >= 10) throw new ApiException(API_ERROR_CODE.CONFLICT);
    const rows = await sql<{ id: string }>(
      this.pool,
      `INSERT INTO deposits (user_id, method_id, amount_minor, currency, reference, user_note, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id`,
      [userId, input.methodId, input.amountMinor, this.cfg.currency, newReference("D"), input.note ?? "", idem],
    );
    const id = rows[0]?.id;
    if (!id) throw new ApiException(API_ERROR_CODE.CONFLICT);
    await audit(this.pool, { action: "deposit.create", actorId: userId, requestId, metadata: { depositId: id } });
    const created = await this.depositById(id, userId);
    if (!created) throw notFound();
    return created;
  }

  listDeposits(userId: string): Promise<DepositDto[]> {
    return sql<DepositDto>(this.pool, `SELECT ${DEP_COLS} FROM deposits d JOIN payment_methods m ON m.id = d.method_id WHERE d.user_id = $1 ORDER BY d.created_at DESC LIMIT 100`, [userId]);
  }

  async getDeposit(userId: string, id: string): Promise<DepositDto> {
    const d = await this.depositById(id, userId);
    if (!d) throw notFound();
    return d;
  }

  async cancelDeposit(userId: string, id: string, requestId: string): Promise<DepositDto> {
    const rows = await sql<{ id: string }>(this.pool, `UPDATE deposits SET status = 'CANCELLED', updated_at = now() WHERE id = $1 AND user_id = $2 AND status = 'PENDING' RETURNING id`, [id, userId]);
    if (!rows[0]) {
      if (!(await this.depositById(id, userId))) throw notFound();
      throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
    }
    await audit(this.pool, { action: "deposit.cancel", actorId: userId, requestId, metadata: { depositId: id } });
    return this.getDeposit(userId, id);
  }

  /* ---------- Levantamentos (cliente) ---------- */

  private async withdrawalById(id: string, userId: string | null): Promise<WithdrawalDto | undefined> {
    return one<WithdrawalDto>(this.pool, `SELECT ${WD_COLS} FROM withdrawals w JOIN payment_methods m ON m.id = w.method_id WHERE w.id = $1 AND ($2::uuid IS NULL OR w.user_id = $2)`, [id, userId]);
  }

  async createWithdrawal(userId: string, input: { methodId: string; amountMinor: number; destination: string }, idem: string | null, requestId: string): Promise<WithdrawalDto> {
    await this.gate.check(userId);
    const m = await one<{ minMinor: number | null; maxMinor: number | null }>(
      this.pool,
      `SELECT min_minor::float8 AS "minMinor", max_minor::float8 AS "maxMinor" FROM payment_methods WHERE id = $1 AND kind = 'WITHDRAWAL' AND enabled`,
      [input.methodId],
    );
    if (!m) throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "methodId", code: "invalid" }] });
    checkRange(input.amountMinor, m.minMinor, m.maxMinor);
    const id = await tx(this.pool, async (c) => {
      await lockUser(c, userId);
      if (idem) {
        const ex = await one<{ id: string; methodId: string; amountMinor: number }>(
          c,
          `SELECT id, method_id AS "methodId", amount_minor::float8 AS "amountMinor" FROM withdrawals WHERE user_id = $1 AND idempotency_key = $2`,
          [userId, idem],
        );
        if (ex) {
          if (ex.methodId !== input.methodId || ex.amountMinor !== input.amountMinor) throw new ApiException(API_ERROR_CODE.IDEMPOTENCY_CONFLICT);
          return ex.id;
        }
      }
      const open = await one<{ n: number }>(c, "SELECT count(*)::int AS n FROM withdrawals WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED')", [userId]);
      if ((open?.n ?? 0) >= 10) throw new ApiException(API_ERROR_CODE.CONFLICT);
      const bal = await getBalance(c, userId);
      if (input.amountMinor > bal.available) {
        throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "amountMinor", code: "insufficientFunds" }] });
      }
      const row = await one<{ id: string }>(
        c,
        `INSERT INTO withdrawals (user_id, method_id, amount_minor, currency, destination, reference, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [userId, input.methodId, input.amountMinor, this.cfg.currency, input.destination, newReference("W"), idem],
      );
      if (!row) throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
      await post(c, { userId, currency: this.cfg.currency, kind: "WITHDRAWAL_RESERVE", refType: "WITHDRAWAL", refId: row.id, actorId: userId, legs: reserveLegs(input.amountMinor) });
      await audit(c, { action: "withdrawal.create", actorId: userId, requestId, metadata: { withdrawalId: row.id } });
      return row.id;
    });
    const created = await this.withdrawalById(id, userId);
    if (!created) throw notFound();
    return created;
  }

  listWithdrawals(userId: string): Promise<WithdrawalDto[]> {
    return sql<WithdrawalDto>(this.pool, `SELECT ${WD_COLS} FROM withdrawals w JOIN payment_methods m ON m.id = w.method_id WHERE w.user_id = $1 ORDER BY w.created_at DESC LIMIT 100`, [userId]);
  }

  async getWithdrawal(userId: string, id: string): Promise<WithdrawalDto> {
    const w = await this.withdrawalById(id, userId);
    if (!w) throw notFound();
    return w;
  }

  async cancelWithdrawal(userId: string, id: string, requestId: string): Promise<WithdrawalDto> {
    await tx(this.pool, async (c) => {
      await lockUser(c, userId);
      const w = await one<{ status: string; amountMinor: number; currency: string }>(
        c,
        `SELECT status, amount_minor::float8 AS "amountMinor", currency FROM withdrawals WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, userId],
      );
      if (!w) throw notFound();
      if (w.status !== "PENDING") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      await sql(c, "UPDATE withdrawals SET status = 'CANCELLED', updated_at = now() WHERE id = $1", [id]);
      await post(c, { userId, currency: w.currency, kind: "WITHDRAWAL_RELEASE", refType: "WITHDRAWAL", refId: id, actorId: userId, legs: releaseLegs(w.amountMinor) });
      await audit(c, { action: "withdrawal.cancel", actorId: userId, requestId, metadata: { withdrawalId: id } });
    });
    return this.getWithdrawal(userId, id);
  }

  /* ---------- Administração: métodos ---------- */

  adminMethods(): Promise<PaymentMethodDto[]> {
    return sql<PaymentMethodDto>(this.pool, `SELECT ${METHOD_COLS} FROM payment_methods m ORDER BY m.kind, m.sort_order, m.name`);
  }

  async adminSaveMethod(id: string | null, v: Omit<PaymentMethodDto, "id">, ctx: Ctx): Promise<PaymentMethodDto> {
    if (v.minMinor !== null && v.maxMinor !== null && v.minMinor > v.maxMinor) {
      throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "maxMinor", code: "belowMinimum" }] });
    }
    const p = [v.kind, v.name, v.instructions, v.minMinor, v.maxMinor, v.feeMinor, v.feeNote, v.enabled, v.sortOrder];
    const row = id
      ? await one<{ id: string }>(
          this.pool,
          `UPDATE payment_methods SET kind=$2, name=$3, instructions=$4, min_minor=$5, max_minor=$6, fee_minor=$7, fee_note=$8, enabled=$9, sort_order=$10, updated_at=now() WHERE id=$1 RETURNING id`,
          [id, ...p],
        )
      : await one<{ id: string }>(
          this.pool,
          `INSERT INTO payment_methods (kind, name, instructions, min_minor, max_minor, fee_minor, fee_note, enabled, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          p,
        );
    if (!row) throw notFound();
    await audit(this.pool, { action: id ? "admin.method.update" : "admin.method.create", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { methodId: row.id } });
    const saved = await one<PaymentMethodDto>(this.pool, `SELECT ${METHOD_COLS} FROM payment_methods m WHERE m.id = $1`, [row.id]);
    if (!saved) throw notFound();
    return saved;
  }

  /* ---------- Administração: depósitos ---------- */

  adminDeposits(status: string | null, id: string | null = null): Promise<AdminDepositDto[]> {
    return sql<AdminDepositDto>(
      this.pool,
      `SELECT ${DEP_COLS}${WITH_USER} FROM deposits d JOIN payment_methods m ON m.id = d.method_id JOIN users u ON u.id = d.user_id
        WHERE ($1::text IS NULL OR d.status = $1) AND ($2::uuid IS NULL OR d.id = $2) ORDER BY d.created_at DESC LIMIT 200`,
      [status, id],
    );
  }

  async adminDecideDeposit(ctx: Ctx, id: string, action: "confirm" | "reject", note: string): Promise<AdminDepositDto> {
    await tx(this.pool, async (c) => {
      const d = await one<{ userId: string; status: string; amountMinor: number; currency: string; reference: string }>(
        c,
        `SELECT user_id AS "userId", status, amount_minor::float8 AS "amountMinor", currency, reference FROM deposits WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!d) throw notFound();
      if (d.status !== "PENDING") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      if (d.userId === ctx.actorId) throw new ApiException(API_ERROR_CODE.FORBIDDEN);
      await lockUser(c, d.userId);
      const confirm = action === "confirm";
      await sql(c, `UPDATE deposits SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4, updated_at = now() WHERE id = $1`, [id, confirm ? "CONFIRMED" : "REJECTED", ctx.actorId, note]);
      if (confirm) {
        await post(c, { userId: d.userId, currency: d.currency, kind: "DEPOSIT_CONFIRMED", refType: "DEPOSIT", refId: id, actorId: ctx.actorId, legs: [{ bucket: "AVAILABLE", amount: d.amountMinor }] });
      }
      await notify(c, d.userId, confirm ? "DEPOSIT_CONFIRMED" : "DEPOSIT_REJECTED", { reference: d.reference, amountMinor: d.amountMinor });
      await audit(c, { action: `admin.deposit.${action}`, actorId: ctx.actorId, requestId: ctx.requestId, metadata: { depositId: id } });
    });
    const out = (await this.adminDeposits(null, id))[0];
    if (!out) throw notFound();
    return out;
  }

  /* ---------- Administração: levantamentos ---------- */

  adminWithdrawals(status: string | null, id: string | null = null): Promise<AdminWithdrawalDto[]> {
    return sql<AdminWithdrawalDto>(
      this.pool,
      `SELECT ${WD_COLS}${WITH_USER} FROM withdrawals w JOIN payment_methods m ON m.id = w.method_id JOIN users u ON u.id = w.user_id
        WHERE ($1::text IS NULL OR w.status = $1) AND ($2::uuid IS NULL OR w.id = $2) ORDER BY w.created_at DESC LIMIT 200`,
      [status, id],
    );
  }

  async adminDecideWithdrawal(ctx: Ctx, id: string, action: "approve" | "paid" | "reject", note: string): Promise<AdminWithdrawalDto> {
    await tx(this.pool, async (c) => {
      const w = await one<{ userId: string; status: string; amountMinor: number; currency: string; reference: string }>(
        c,
        `SELECT user_id AS "userId", status, amount_minor::float8 AS "amountMinor", currency, reference FROM withdrawals WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!w) throw notFound();
      const allowed = action === "approve" ? w.status === "PENDING" : action === "paid" ? w.status === "APPROVED" : w.status === "PENDING" || w.status === "APPROVED";
      if (!allowed) throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      if (w.userId === ctx.actorId) throw new ApiException(API_ERROR_CODE.FORBIDDEN);
      await lockUser(c, w.userId);
      const next = action === "approve" ? "APPROVED" : action === "paid" ? "PAID" : "REJECTED";
      await sql(c, `UPDATE withdrawals SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4, updated_at = now() WHERE id = $1`, [id, next, ctx.actorId, note]);
      const base = { userId: w.userId, currency: w.currency, refType: "WITHDRAWAL" as const, refId: id, actorId: ctx.actorId };
      if (action === "paid") await post(c, { ...base, kind: "WITHDRAWAL_PAID", legs: [{ bucket: "RESERVED", amount: -w.amountMinor }] });
      if (action === "reject") await post(c, { ...base, kind: "WITHDRAWAL_RELEASE", legs: releaseLegs(w.amountMinor) });
      await notify(c, w.userId, `WITHDRAWAL_${next}`, { reference: w.reference, amountMinor: w.amountMinor });
      await audit(c, { action: `admin.withdrawal.${action}`, actorId: ctx.actorId, requestId: ctx.requestId, metadata: { withdrawalId: id } });
    });
    const out = (await this.adminWithdrawals(null, id))[0];
    if (!out) throw notFound();
    return out;
  }
}
