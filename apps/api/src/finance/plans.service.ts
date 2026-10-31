import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE, type AdminSubscriptionDto, type PlanConfigInput, type PlanDto, type SubscriptionDto } from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { FINANCE_CONFIG, FinanceGate, PG_POOL, type FinanceConfig } from "./finance.config.js";
import { checkRange } from "./payments.service.js";
import { activateSubscription, evaluatePlanRate } from "./plan-accrual.js";
import { audit, getBalance, lockUser, newReference, notify, one, post, releaseLegs, reserveLegs, sql, tx, type Ctx } from "./sql.js";

const LAST_SEGMENT = (col: string): string => `(SELECT g.${col} FROM plan_rate_segments g WHERE g.plan_id = p.id ORDER BY g.at DESC LIMIT 1)`;
const PLAN_COLS = `p.id, p.name, p.description, p.min_minor::float8 AS "minMinor", p.max_minor::float8 AS "maxMinor",
  p.capacity_minor::float8 AS "capacityMinor",
  CASE WHEN p.capacity_minor IS NULL THEN NULL
       ELSE COALESCE((SELECT SUM(s.amount_minor) FROM plan_subscriptions s WHERE s.plan_id = p.id AND s.status IN ('PENDING', 'ACTIVE')), 0)::float8 END AS "committedMinor",
  p.term_days AS "termDays", p.risk_label AS "riskLabel", p.status, p.sort_order AS "sortOrder",
  CASE WHEN p.image_mime IS NULL THEN NULL ELSE '/v1/plans/' || p.id::text || '/image?v=' || (extract(epoch FROM p.updated_at) * 1000)::bigint::text END AS "imageUrl",
  p.how_it_works AS "howItWorks", p.risk_details AS "riskDetails", p.rate_mode AS "rateMode",
  p.market_symbol AS "marketSymbol", p.market_label AS "marketLabel",
  p.base_rate_bps AS "baseRateBps", p.min_rate_bps AS "minRateBps", p.max_rate_bps AS "maxRateBps",
  p.sensitivity_bps_per_pct AS "sensitivityBpsPerPct", p.payout_interval_days AS "payoutIntervalDays",
  p.invite_boost_x100 AS "inviteBoostX100", p.auto_activate AS "autoActivate",
  ${LAST_SEGMENT("rate_bps::float8")} AS "currentRateBps", ${LAST_SEGMENT("change_pct::float8")} AS "currentChangePct"`;
const SUB_COLS = `s.id, s.reference, s.plan_id AS "planId", p.name AS "planName", s.amount_minor::float8 AS "amountMinor", s.currency, s.status,
  s.decision_note AS "decisionNote", s.created_at AS "createdAt", s.decided_at AS "decidedAt",
  s.starts_at AS "startsAt", s.ends_at AS "endsAt"`;
const notFound = (): ApiException => new ApiException(API_ERROR_CODE.NOT_FOUND);

/** O conteúdo tem de ser mesmo do tipo declarado (não se confia só no que o cliente diz). */
function imageMatches(buf: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === "image/png") return buf[0] === 0x89 && buf.subarray(1, 4).toString("ascii") === "PNG";
  if (mime === "image/webp") return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

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

  /** Plano para o painel de uma subscrição já feita (inclui planos que entretanto passaram a rascunho). */
  async getForPanel(id: string): Promise<PlanDto> {
    const p = await one<PlanDto>(this.pool, `SELECT ${PLAN_COLS} FROM plans p WHERE p.id = $1`, [id]);
    if (!p) throw notFound();
    return p;
  }

  async subscribe(userId: string, planId: string, amountMinor: number, idem: string | null, requestId: string): Promise<SubscriptionDto> {
    await this.gate.check(userId);
    const id = await tx(this.pool, async (c) => {
      await lockUser(c, userId);
      const plan = await one<{ status: string; minMinor: number | null; maxMinor: number | null; capacityMinor: number | null; autoActivate: boolean }>(
        c,
        `SELECT status, min_minor::float8 AS "minMinor", max_minor::float8 AS "maxMinor", capacity_minor::float8 AS "capacityMinor", auto_activate AS "autoActivate" FROM plans WHERE id = $1 FOR UPDATE`,
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
      if (plan.autoActivate) {
        // Plano sem aprovação manual: o capital já está reservado, a vida do plano começa agora.
        await sql(c, `UPDATE plan_subscriptions SET status = 'ACTIVE', decided_at = now(), decision_note = 'Activação automática', updated_at = now() WHERE id = $1`, [row.id]);
        await activateSubscription(c, row.id);
        await audit(c, { action: "subscription.auto_activate", actorId: userId, requestId, metadata: { subscriptionId: row.id } });
      }
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

  async adminSavePlan(id: string | null, v: PlanConfigInput, ctx: Ctx): Promise<PlanDto> {
    if (v.minMinor !== null && v.maxMinor !== null && v.minMinor > v.maxMinor) {
      throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "maxMinor", code: "belowMinimum" }] });
    }
    if (v.minRateBps > v.baseRateBps || v.baseRateBps > v.maxRateBps) {
      throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "maxRateBps", code: "rateOrder" }] });
    }
    if (v.rateMode === "MARKET" && !v.marketSymbol) {
      throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "marketSymbol", code: "required" }] });
    }
    const p = [
      v.name, v.description, v.minMinor, v.maxMinor, v.capacityMinor, v.termDays, v.riskLabel, v.status, v.sortOrder,
      v.howItWorks, v.riskDetails, v.rateMode, v.marketSymbol, v.marketLabel,
      v.baseRateBps, v.minRateBps, v.maxRateBps, v.sensitivityBpsPerPct, v.payoutIntervalDays, v.inviteBoostX100, v.autoActivate,
    ];
    const row = id
      ? await one<{ id: string }>(
          this.pool,
          `UPDATE plans SET name=$2, description=$3, min_minor=$4, max_minor=$5, capacity_minor=$6, term_days=$7, risk_label=$8, status=$9, sort_order=$10,
                  how_it_works=$11, risk_details=$12, rate_mode=$13, market_symbol=$14, market_label=$15,
                  base_rate_bps=$16, min_rate_bps=$17, max_rate_bps=$18, sensitivity_bps_per_pct=$19, payout_interval_days=$20, invite_boost_x100=$21, auto_activate=$22,
                  updated_at=now() WHERE id=$1 RETURNING id`,
          [id, ...p],
        )
      : await one<{ id: string }>(
          this.pool,
          `INSERT INTO plans (name, description, min_minor, max_minor, capacity_minor, term_days, risk_label, status, sort_order,
                  how_it_works, risk_details, rate_mode, market_symbol, market_label,
                  base_rate_bps, min_rate_bps, max_rate_bps, sensitivity_bps_per_pct, payout_interval_days, invite_boost_x100, auto_activate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
          p,
        );
    if (!row) throw notFound();
    // A nova configuração de taxas passa a valer já (novo segmento); o que já foi gerado fica como estava.
    await evaluatePlanRate(this.pool, row.id, true);
    await audit(this.pool, { action: id ? "admin.plan.update" : "admin.plan.create", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { planId: row.id } });
    const saved = await one<PlanDto>(this.pool, `SELECT ${PLAN_COLS} FROM plans p WHERE p.id = $1`, [row.id]);
    if (!saved) throw notFound();
    return saved;
  }

  /* ---------- Imagem do plano ---------- */

  async image(id: string): Promise<{ mime: string; content: Buffer }> {
    const r = await one<{ mime: string | null; content: Buffer | null }>(this.pool, `SELECT image_mime AS mime, image_content AS content FROM plans WHERE id = $1`, [id]);
    if (!r?.mime || !r.content) throw notFound();
    return { mime: r.mime, content: r.content };
  }

  async adminSetImage(id: string, input: { mime: "image/jpeg" | "image/png" | "image/webp"; dataBase64: string }, ctx: Ctx): Promise<PlanDto> {
    const buf = Buffer.from(input.dataBase64, "base64");
    if (buf.length < 100 || buf.length > 2_000_000 || !imageMatches(buf, input.mime)) {
      throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field: "image", code: "invalid" }] });
    }
    const r = await one<{ id: string }>(this.pool, `UPDATE plans SET image_mime = $2, image_content = $3, updated_at = now() WHERE id = $1 RETURNING id`, [id, input.mime, buf]);
    if (!r) throw notFound();
    await audit(this.pool, { action: "admin.plan.image", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { planId: id } });
    return this.getForPanel(id);
  }

  async adminRemoveImage(id: string, ctx: Ctx): Promise<PlanDto> {
    const r = await one<{ id: string }>(this.pool, `UPDATE plans SET image_mime = NULL, image_content = NULL, updated_at = now() WHERE id = $1 RETURNING id`, [id]);
    if (!r) throw notFound();
    await audit(this.pool, { action: "admin.plan.image.remove", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { planId: id } });
    return this.getForPanel(id);
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
      if (approve) await activateSubscription(c, id);
      if (!approve) await post(c, { userId: s.userId, currency: s.currency, kind: "SUBSCRIPTION_RELEASE", refType: "SUBSCRIPTION", refId: id, actorId: ctx.actorId, legs: releaseLegs(s.amountMinor) });
      await notify(c, s.userId, approve ? "SUBSCRIPTION_APPROVED" : "SUBSCRIPTION_REJECTED", { reference: s.reference, amountMinor: s.amountMinor });
      await audit(c, { action: `admin.subscription.${action}`, actorId: ctx.actorId, requestId: ctx.requestId, metadata: { subscriptionId: id } });
    });
    const out = (await this.adminSubscriptions(null, id))[0];
    if (!out) throw notFound();
    return out;
  }
}
