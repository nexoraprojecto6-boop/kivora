import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE, type AdminSubscriptionDto, type PlanDto, type SubscriptionDto } from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { FINANCE_CONFIG, FinanceGate, PG_POOL, type FinanceConfig } from "./finance.config.js";
import { checkRange } from "./payments.service.js";
import { audit, getBalance, lockUser, newReference, notify, one, post, releaseLegs, reserveLegs, sql, tx, type Ctx } from "./sql.js";

const PLAN_COLS = `p.id, p.name, p.description, p.min_minor::float8 AS "minMinor", p.max_minor::float8 AS "maxMinor",
  p.capacity_minor::float8 AS "capacityMinor",
  CASE WHEN p.capacity_minor IS NULL THEN NULL
       ELSE COALESCE((SELECT SUM(s.amount_minor) FROM plan_subscriptions s WHERE s.plan_id = p.id AND s.status IN ('PENDING', 'ACTIVE')), 0)::float8 END AS "committedMinor",
  p.term_days AS "termDays", p.risk_label AS "riskLabel", p.status, p.sort_order AS "sortOrder"`;
const SUB_COLS = `s.id, s.reference, s.plan_id AS "planId", p.name AS "planName", s.amount_minor::float8 AS "amountMinor", s.currency, s.status,
  s.decision_note AS "decisionNote", s.created_at AS "createdAt", s.decided_at AS "decidedAt"`;
const notFound = (): ApiException => new ApiException(API_ERROR_CODE.NOT_FOUND);

@Injectable()
export class PlansService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(FINANCE_CONFIG) private readonly cfg: FinanceConfig,
    private readonly gate: FinanceGate,
  ) {}

  list(): Promise<PlanDto[]> {
    return sql<PlanDto>(this.pool, `SELECT ${PLAN_COLS} FROM plans p WHERE p.status IN ('OPEN', 'COMING_SOON', 'CLOSED') ORDER BY p.sort_order, p.name`);
  }

  async get(id: string): Promise<PlanDto> {
    const p = await one<PlanDto>(this.pool, `SELECT ${PLAN_COLS} FROM plans p WHERE p.id = $1 AND p.status <> 'DRAFT'`, [id]);
    if (!p) throw notFound();
    return p;
  }

  async subscribe(userId: string, planId: string, amountMinor: number, idem: string | null, requestId: string): Promise<SubscriptionDto> {
    await this.gate.check(userId);
    const id = await tx(this.pool, async (c) => {
      await lockUser(c, userId);
      const plan = await one<{ status: string; minMinor: number | null; maxMinor: number | null; capacityMinor: number | null }>(
        c,
        `SELECT status, min_minor::float8 AS "minMinor", max_minor::float8 AS "maxMinor", capacity_minor::float8 AS "capacityMinor" FROM plans WHERE id = $1 FOR UPDATE`,
        [planId],
      );
      if (!plan || plan.status === "DRAFT") throw notFound();
      if (plan.status !== "OPEN") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      checkRange(amountMinor, plan.minMinor, plan.maxMinor);
      if (idem) {
        const ex = await one<{ id: string; planId: string; amountMinor: number }>(c, `SELECT id, plan_id AS "planId", amount_minor::float8 AS "amountMinor" FROM plan_subscriptions WHERE user_id = $1 AND idempotency_key = $2`, [userId, idem]);
        if (ex) {
          if (ex.planId !== planId || ex.amountMinor !== amountMinor) throw new ApiException(API_ERROR_CODE.IDEMPOTENCY_CONFLICT);
          return ex.id;
        }
      }
      if (plan.capacityMinor !== null) {
        const used = await one<{ n: number }>(c, `SELECT COALESCE(SUM(amount_minor), 0)::float8 AS n FROM plan_subscriptions WHERE plan_id = $1 AND status IN ('PENDING', 'ACTIVE')`, [planId]);
        if ((used?.n ?? 0) + amountMinor > plan.capacityMinor) throw new ApiException(API_ERROR_CODE.CONFLICT, { fieldErrors: [{ field: "amountMinor", code: "capacityExceeded" }] });
      }
      const bal = await getBalance(c, userId);
      if (amountMinor > bal.available) throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "amountMinor", code: "insufficientFunds" }] });
      const row = await one<{ id: string }>(
        c,
        `INSERT INTO plan_subscriptions (user_id, plan_id, amount_minor, currency, reference, idempotency_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId, planId, amountMinor, this.cfg.currency, newReference("S"), idem],
      );
      if (!row) throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
      await post(c, { userId, currency: this.cfg.currency, kind: "SUBSCRIPTION_RESERVE", refType: "SUBSCRIPTION", refId: row.id, actorId: userId, legs: reserveLegs(amountMinor) });
      await audit(c, { action: "subscription.create", actorId: userId, requestId, metadata: { subscriptionId: row.id } });
      return row.id;
    });
    return this.mine(userId, id);
  }

  async mine(userId: string, id: string): Promise<SubscriptionDto> {
    const s = await one<SubscriptionDto>(this.pool, `SELECT ${SUB_COLS} FROM plan_subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.id = $1 AND s.user_id = $2`, [id, userId]);
    if (!s) throw notFound();
    return s;
  }

  listMine(userId: string): Promise<SubscriptionDto[]> {
    return sql<SubscriptionDto>(this.pool, `SELECT ${SUB_COLS} FROM plan_subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 100`, [userId]);
  }

  async cancel(userId: string, id: string, requestId: string): Promise<SubscriptionDto> {
    await tx(this.pool, async (c) => {
      await lockUser(c, userId);
      const s = await one<{ status: string; amountMinor: number; currency: string }>(c, `SELECT status, amount_minor::float8 AS "amountMinor", currency FROM plan_subscriptions WHERE id = $1 AND user_id = $2 FOR UPDATE`, [id, userId]);
      if (!s) throw notFound();
      if (s.status !== "PENDING") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      await sql(c, "UPDATE plan_subscriptions SET status = 'CANCELLED', updated_at = now() WHERE id = $1", [id]);
      await post(c, { userId, currency: s.currency, kind: "SUBSCRIPTION_RELEASE", refType: "SUBSCRIPTION", refId: id, actorId: userId, legs: releaseLegs(s.amountMinor) });
      await audit(c, { action: "subscription.cancel", actorId: userId, requestId, metadata: { subscriptionId: id } });
    });
    return this.mine(userId, id);
  }

  /* ---------- Administração ---------- */

  adminPlans(): Promise<PlanDto[]> {
    return sql<PlanDto>(this.pool, `SELECT ${PLAN_COLS} FROM plans p ORDER BY p.sort_order, p.name`);
  }

  async adminSavePlan(id: string | null, v: Omit<PlanDto, "id" | "committedMinor">, ctx: Ctx): Promise<PlanDto> {
    if (v.minMinor !== null && v.maxMinor !== null && v.minMinor > v.maxMinor) {
      throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "maxMinor", code: "belowMinimum" }] });
    }
    const p = [v.name, v.description, v.minMinor, v.maxMinor, v.capacityMinor, v.termDays, v.riskLabel, v.status, v.sortOrder];
    const row = id
      ? await one<{ id: string }>(this.pool, `UPDATE plans SET name=$2, description=$3, min_minor=$4, max_minor=$5, capacity_minor=$6, term_days=$7, risk_label=$8, status=$9, sort_order=$10, updated_at=now() WHERE id=$1 RETURNING id`, [id, ...p])
      : await one<{ id: string }>(this.pool, `INSERT INTO plans (name, description, min_minor, max_minor, capacity_minor, term_days, risk_label, status, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, p);
    if (!row) throw notFound();
    await audit(this.pool, { action: id ? "admin.plan.update" : "admin.plan.create", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { planId: row.id } });
    const saved = await one<PlanDto>(this.pool, `SELECT ${PLAN_COLS} FROM plans p WHERE p.id = $1`, [row.id]);
    if (!saved) throw notFound();
    return saved;
  }

  adminSubscriptions(status: string | null, id: string | null = null): Promise<AdminSubscriptionDto[]> {
    return sql<AdminSubscriptionDto>(
      this.pool,
      `SELECT ${SUB_COLS}, u.id AS "userId", u.email AS "userEmail", u.full_name AS "userName"
         FROM plan_subscriptions s JOIN plans p ON p.id = s.plan_id JOIN users u ON u.id = s.user_id
        WHERE ($1::text IS NULL OR s.status = $1) AND ($2::uuid IS NULL OR s.id = $2) ORDER BY s.created_at DESC LIMIT 200`,
      [status, id],
    );
  }

  async adminDecide(ctx: Ctx, id: string, action: "approve" | "reject", note: string): Promise<AdminSubscriptionDto> {
    await tx(this.pool, async (c) => {
      const s = await one<{ userId: string; status: string; amountMinor: number; currency: string; reference: string }>(c, `SELECT user_id AS "userId", status, amount_minor::float8 AS "amountMinor", currency, reference FROM plan_subscriptions WHERE id = $1 FOR UPDATE`, [id]);
      if (!s) throw notFound();
      if (s.status !== "PENDING") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      if (s.userId === ctx.actorId) throw new ApiException(API_ERROR_CODE.FORBIDDEN);
      await lockUser(c, s.userId);
      const approve = action === "approve";
      await sql(c, `UPDATE plan_subscriptions SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4, updated_at = now() WHERE id = $1`, [id, approve ? "ACTIVE" : "REJECTED", ctx.actorId, note]);
      if (!approve) await post(c, { userId: s.userId, currency: s.currency, kind: "SUBSCRIPTION_RELEASE", refType: "SUBSCRIPTION", refId: id, actorId: ctx.actorId, legs: releaseLegs(s.amountMinor) });
      await notify(c, s.userId, approve ? "SUBSCRIPTION_APPROVED" : "SUBSCRIPTION_REJECTED", { reference: s.reference, amountMinor: s.amountMinor });
      await audit(c, { action: `admin.subscription.${action}`, actorId: ctx.actorId, requestId: ctx.requestId, metadata: { subscriptionId: id } });
    });
    const out = (await this.adminSubscriptions(null, id))[0];
    if (!out) throw notFound();
    return out;
  }
}
