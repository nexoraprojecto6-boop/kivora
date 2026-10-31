import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import {
  API_ERROR_CODE,
  type AdminPlanStatsDto,
  type EarningsSeriesDto,
  type PlanDto,
  type PlanEarningsDto,
  type PlanPayoutDto,
  type PlanPayoutStateDto,
  type PlanRateDto,
  type SeriesBucket,
  type SubscriptionDto,
  type SubscriptionLiveDto,
  type SubscriptionPanelDto,
} from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { FinanceGate, PG_POOL } from "./finance.config.js";
import { MarketService } from "./market.service.js";
import { accrueBetween, boostSteps, countQualifiedInvitees, multiplierAt, persistAccrual, refreshBoostForReferrerOf, type BoostStep } from "./plan-accrual.js";
import { PlansService } from "./plans.service.js";
import { audit, lockUser, notify, one, post, releaseLegs, sql, tx } from "./sql.js";

const DAY_MS = 86_400_000;
const BPS_SECONDS_DIVISOR = 10_000 * 86_400;
const notFound = (): ApiException => new ApiException(API_ERROR_CODE.NOT_FOUND);
const state = (code: string): ApiException => new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION, { fieldErrors: [{ field: "claim", code }] });

interface SubRow {
  id: string;
  userId: string;
  planId: string;
  amountMinor: number;
  currency: string;
  status: SubscriptionDto["status"];
  accrued: number;
  accruedUpto: Date | null;
  claimedMinor: number;
  lastClaimAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
}
interface PlanRow {
  marketProvider: string;
  marketSymbol: string | null;
  marketLabel: string;
  rateMode: "FIXED" | "MARKET";
  baseRateBps: number;
  minRateBps: number;
  maxRateBps: number;
  sensitivityBpsPerPct: number;
  payoutIntervalDays: number;
}

const SUB_ROW = `s.id, s.user_id AS "userId", s.plan_id AS "planId", s.amount_minor::float8 AS "amountMinor", s.currency, s.status,
  s.accrued::float8 AS accrued, s.accrued_upto AS "accruedUpto", s.claimed_minor::float8 AS "claimedMinor", s.last_claim_at AS "lastClaimAt",
  s.starts_at AS "startsAt", s.ends_at AS "endsAt"`;
const PLAN_ROW = `p.market_provider AS "marketProvider", p.market_symbol AS "marketSymbol", p.market_label AS "marketLabel", p.rate_mode AS "rateMode",
  p.base_rate_bps AS "baseRateBps", p.min_rate_bps AS "minRateBps", p.max_rate_bps AS "maxRateBps",
  p.sensitivity_bps_per_pct AS "sensitivityBpsPerPct", p.payout_interval_days AS "payoutIntervalDays"`;

const BUCKETS: Record<SeriesBucket, { unit: string; step: string; count: number }> = {
  minute: { unit: "minute", step: "1 minute", count: 60 },
  hour: { unit: "hour", step: "1 hour", count: 48 },
  day: { unit: "day", step: "1 day", count: 30 },
};

/**
 * Painel do plano, comissão gerada, levantamento para a carteira e fim do plano. Tudo calculado e validado aqui.
 * O cliente só pode ler os seus dados e pedir o levantamento; não envia valores nem taxas.
 */
@Injectable()
export class PlanEarningsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PlanEarningsService.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private cycles = 0;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly gate: FinanceGate,
    private readonly market: MarketService,
    private readonly plans: PlansService,
  ) {}

  /* ---------- tarefas de fundo ---------- */

  onModuleInit(): void {
    if (process.env["PLAN_JOBS_ENABLED"] === "false") return;
    this.timer = setInterval(() => void this.cycle(), 60_000);
    this.timer.unref();
    setTimeout(() => void this.cycle(), 8_000).unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Termina planos vencidos, guarda a comissão acumulada e limpa dados antigos (1x por hora). */
  async cycle(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.settleDue();
      await this.rollup();
      this.cycles += 1;
      if (this.cycles % 60 === 1) await this.market.prune();
    } catch (error) {
      this.log.error(`Ciclo dos planos falhou: ${error instanceof Error ? error.message : "erro"}`);
    } finally {
      this.busy = false;
    }
  }

  async settleDue(): Promise<number> {
    const due = await sql<{ id: string }>(this.pool, `SELECT id FROM plan_subscriptions WHERE status = 'ACTIVE' AND ends_at IS NOT NULL AND ends_at <= now() ORDER BY ends_at LIMIT 200`);
    let n = 0;
    for (const d of due) {
      try {
        if (await this.settleOne(d.id)) n += 1;
      } catch (error) {
        this.log.error(`Fim de plano ${d.id} falhou: ${error instanceof Error ? error.message : "erro"}`);
      }
    }
    return n;
  }

  /** Guarda a comissão acumulada das subscrições activas (limita o trabalho de cada leitura do painel). */
  async rollup(): Promise<void> {
    const rows = await sql<{ id: string; userId: string }>(
      this.pool,
      `SELECT id, user_id AS "userId" FROM plan_subscriptions WHERE status = 'ACTIVE' AND accrued_upto IS NOT NULL AND accrued_upto < now() - interval '5 minutes' ORDER BY accrued_upto LIMIT 300`,
    );
    for (const r of rows) {
      try {
        await tx(this.pool, async (c) => {
          await lockUser(c, r.userId);
          await persistAccrual(c, r.id, new Date());
        });
      } catch (error) {
        this.log.error(`Acumulação ${r.id} falhou: ${error instanceof Error ? error.message : "erro"}`);
      }
    }
  }

  /**
   * Fim do plano (prazo definido pela administração): fecha a comissão, envia o que falta para a carteira,
   * devolve o capital ao saldo disponível e passa a subscrição a COMPLETED. Seguro contra repetição.
   */
  async settleOne(subscriptionId: string): Promise<boolean> {
    const pre = await one<{ userId: string }>(this.pool, `SELECT user_id AS "userId" FROM plan_subscriptions WHERE id = $1`, [subscriptionId]);
    if (!pre) return false;
    return tx(this.pool, async (c) => {
      await lockUser(c, pre.userId);
      const s = await one<{ status: string; endsAt: Date | null; amountMinor: number; currency: string; claimedMinor: number; reference: string }>(
        c,
        `SELECT status, ends_at AS "endsAt", amount_minor::float8 AS "amountMinor", currency, claimed_minor::float8 AS "claimedMinor", reference
           FROM plan_subscriptions WHERE id = $1 FOR UPDATE`,
        [subscriptionId],
      );
      if (!s || s.status !== "ACTIVE" || !s.endsAt || s.endsAt.getTime() > Date.now()) return false;
      const { accrued } = await persistAccrual(c, subscriptionId, s.endsAt);
      const remaining = Math.floor(accrued) - s.claimedMinor;
      if (remaining >= 1) {
        const pay = await one<{ id: string }>(
          c,
          `INSERT INTO subscription_payouts (subscription_id, user_id, amount_minor, currency, kind) VALUES ($1, $2, $3, $4, 'EXPIRY') RETURNING id`,
          [subscriptionId, pre.userId, remaining, s.currency],
        );
        if (pay) {
          await post(c, { userId: pre.userId, currency: s.currency, kind: "PLAN_EARNINGS", refType: "SUBSCRIPTION", refId: subscriptionId, actorId: null, legs: [{ bucket: "AVAILABLE", amount: remaining }] });
        }
      }
      await sql(c, `UPDATE plan_subscriptions SET status = 'COMPLETED', completed_at = now(), claimed_minor = GREATEST(claimed_minor, $2), updated_at = now() WHERE id = $1`, [subscriptionId, Math.max(s.claimedMinor, Math.floor(accrued))]);
      await post(c, { userId: pre.userId, currency: s.currency, kind: "SUBSCRIPTION_RELEASE", refType: "SUBSCRIPTION", refId: subscriptionId, actorId: null, legs: releaseLegs(s.amountMinor) });
      await notify(c, pre.userId, "PLAN_COMPLETED", { reference: s.reference, amountMinor: s.amountMinor });
      await audit(c, { action: "subscription.complete", actorId: null, requestId: "system", metadata: { subscriptionId, earningsMinor: Math.max(remaining, 0) } });
      await refreshBoostForReferrerOf(c, pre.userId);
      return true;
    });
  }

  /* ---------- leitura do painel ---------- */

  private async load(userId: string, subscriptionId: string): Promise<{ s: SubRow; plan: PlanRow }> {
    const s = await one<SubRow>(this.pool, `SELECT ${SUB_ROW} FROM plan_subscriptions s WHERE s.id = $1 AND s.user_id = $2`, [subscriptionId, userId]);
    if (!s) throw notFound();
    const plan = await one<PlanRow>(this.pool, `SELECT ${PLAN_ROW} FROM plans p WHERE p.id = $1`, [s.planId]);
    if (!plan) throw notFound();
    return { s, plan };
  }

  async panel(userId: string, subscriptionId: string): Promise<SubscriptionPanelDto> {
    await this.settleIfDue(userId, subscriptionId);
    const { s } = await this.load(userId, subscriptionId);
    const [subscription, plan, live, payouts, qualified, steps] = await Promise.all([
      this.plans.mine(userId, subscriptionId),
      this.plans.getForPanel(s.planId),
      this.live(userId, subscriptionId, null),
      sql<PlanPayoutDto>(
        this.pool,
        `SELECT id, amount_minor::float8 AS "amountMinor", kind, created_at AS "createdAt" FROM subscription_payouts WHERE subscription_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [subscriptionId],
      ),
      countQualifiedInvitees(this.pool, userId),
      boostSteps(this.pool, subscriptionId),
    ]);
    const mult = multiplierAt(steps, new Date());
    return { subscription, plan, boost: { qualifiedInvitees: qualified, multiplierX100: mult, active: mult > 100 }, payouts, live };
  }

  private async settleIfDue(userId: string, subscriptionId: string): Promise<void> {
    const r = await one<{ due: boolean }>(this.pool, `SELECT (status = 'ACTIVE' AND ends_at IS NOT NULL AND ends_at <= now()) AS due FROM plan_subscriptions WHERE id = $1 AND user_id = $2`, [subscriptionId, userId]);
    if (r?.due) await this.settleOne(subscriptionId);
  }

  /** Parte do painel que muda a cada poucos segundos: taxa, mercado, comissão e estado do levantamento. */
  async live(userId: string, subscriptionId: string, since: Date | null): Promise<SubscriptionLiveDto> {
    const { s, plan } = await this.load(userId, subscriptionId);
    const now = new Date();
    const steps = await boostSteps(this.pool, subscriptionId);
    const seg = await one<{ rateBps: number; changePct: number | null; reason: string }>(
      this.pool,
      `SELECT rate_bps::float8 AS "rateBps", change_pct::float8 AS "changePct", reason FROM plan_rate_segments WHERE plan_id = $1 ORDER BY at DESC LIMIT 1`,
      [s.planId],
    );
    const currentBps = seg?.rateBps ?? plan.baseRateBps;
    const boostX100 = s.status === "ACTIVE" ? multiplierAt(steps, now) : 100;
    let limit: PlanRateDto["limit"] = null;
    if (plan.rateMode === "MARKET" && seg?.reason === "MARKET" && seg.changePct !== null) {
      const raw = plan.baseRateBps + plan.sensitivityBpsPerPct * seg.changePct;
      limit = raw < plan.minRateBps ? "MIN" : raw > plan.maxRateBps ? "MAX" : null;
    }
    const rate: PlanRateDto = {
      mode: plan.rateMode,
      baseBps: plan.baseRateBps,
      minBps: plan.minRateBps,
      maxBps: plan.maxRateBps,
      sensitivityBpsPerPct: plan.sensitivityBpsPerPct,
      currentBps,
      boostX100,
      effectiveBps: Math.round(currentBps * boostX100) / 100,
      limit,
    };
    const market = plan.marketSymbol
      ? await this.market.snapshot({ marketProvider: plan.marketProvider, marketSymbol: plan.marketSymbol, marketLabel: plan.marketLabel }, since)
      : null;
    const earnings = await this.earnings(s, rate, steps, now);
    return {
      status: s.status,
      rate,
      market,
      earnings,
      payout: this.payoutState(s, plan, earnings, now),
      remainingSeconds: s.status === "ACTIVE" && s.endsAt ? Math.max(0, Math.floor((s.endsAt.getTime() - now.getTime()) / 1000)) : null,
      serverTime: now.toISOString(),
    };
  }

  private async earnings(s: SubRow, rate: PlanRateDto, steps: readonly BoostStep[], now: Date): Promise<PlanEarningsDto> {
    const zero = { lastMinuteMinor: 0, lastHourMinor: 0, lastDayMinor: 0, perMinuteMinor: 0, perHourMinor: 0, perDayMinor: 0 };
    let generated = s.accrued;
    let windows = zero;
    if (s.status === "ACTIVE" && s.startsAt) {
      const end = s.endsAt && s.endsAt.getTime() < now.getTime() ? s.endsAt : now;
      if (s.accruedUpto) generated += await accrueBetween(this.pool, s, s.accruedUpto, end, steps);
      const back = (ms: number): Date => new Date(Math.max(s.startsAt!.getTime(), end.getTime() - ms));
      const [m1, h1, d1] = await Promise.all([
        accrueBetween(this.pool, s, back(60_000), end, steps),
        accrueBetween(this.pool, s, back(3_600_000), end, steps),
        accrueBetween(this.pool, s, back(DAY_MS), end, steps),
      ]);
      const perDay = (s.amountMinor * rate.effectiveBps) / 10_000;
      windows = { lastMinuteMinor: m1, lastHourMinor: h1, lastDayMinor: d1, perDayMinor: perDay, perHourMinor: perDay / 24, perMinuteMinor: perDay / 1440 };
    }
    return {
      currency: s.currency,
      generatedMinor: generated,
      claimedMinor: s.claimedMinor,
      claimableMinor: s.status === "ACTIVE" ? Math.max(0, Math.floor(generated) - s.claimedMinor) : 0,
      ...windows,
    };
  }

  private payoutState(s: SubRow, plan: PlanRow, earnings: PlanEarningsDto, now: Date): PlanPayoutStateDto {
    const base = s.lastClaimAt ?? s.startsAt;
    const next = s.status === "ACTIVE" && base ? new Date(base.getTime() + plan.payoutIntervalDays * DAY_MS) : null;
    return {
      intervalDays: plan.payoutIntervalDays,
      nextClaimAt: next ? next.toISOString() : null,
      canClaim: next !== null && now.getTime() >= next.getTime() && earnings.claimableMinor >= 1,
      destination: "WALLET",
    };
  }

  /** Comissão gerada por minuto, hora ou dia (para o gráfico de barras do painel). */
  async series(userId: string, subscriptionId: string, bucket: SeriesBucket): Promise<EarningsSeriesDto> {
    const { s } = await this.load(userId, subscriptionId);
    const b = BUCKETS[bucket];
    if (!s.startsAt || (s.status !== "ACTIVE" && s.status !== "COMPLETED")) return { bucket, currency: s.currency, points: [] };
    const now = new Date();
    const end = s.endsAt && s.endsAt.getTime() < now.getTime() ? s.endsAt : now;
    const steps = await boostSteps(this.pool, subscriptionId);
    // unit/step vêm da tabela BUCKETS (nunca do cliente), por isso podem entrar no texto do SQL.
    const rows = await sql<{ t: Date; bs: number }>(
      this.pool,
      `WITH b AS (
         SELECT generate_series(date_trunc('${b.unit}', $2::timestamptz) - ${b.count - 1} * interval '${b.step}', date_trunc('${b.unit}', $2::timestamptz), interval '${b.step}') AS t0
       ), segs AS (
         SELECT at AS a, rate_bps, LEAD(at) OVER (ORDER BY at) AS b2
           FROM plan_rate_segments
          WHERE plan_id = $1
            AND at >= COALESCE((SELECT max(at) FROM plan_rate_segments WHERE plan_id = $1 AND at <= (SELECT min(t0) FROM b)), '-infinity'::timestamptz)
       )
       SELECT b.t0 AS t,
              COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(s.b2, 'infinity'::timestamptz), b.t0 + interval '${b.step}', $2::timestamptz) - GREATEST(s.a, b.t0, $3::timestamptz)))) * s.rate_bps), 0)::float8 AS bs
         FROM b LEFT JOIN segs s ON s.a < b.t0 + interval '${b.step}' AND COALESCE(s.b2, 'infinity'::timestamptz) > b.t0
        GROUP BY b.t0 ORDER BY b.t0`,
      [s.planId, end, s.startsAt],
    );
    return {
      bucket,
      currency: s.currency,
      points: rows.map((r) => ({ t: r.t.toISOString(), amountMinor: (s.amountMinor * (multiplierAt(steps, r.t) / 100) * r.bs) / BPS_SECONDS_DIVISOR })),
    };
  }

  /* ---------- levantar a comissão para a carteira ---------- */

  /**
   * Envia a comissão gerada (parte inteira) para o saldo disponível da carteira. Só quando o prazo entre levantamentos
   * (definido no plano) já passou. O valor é sempre calculado aqui; o pedido do cliente não leva montante.
   */
  async claim(userId: string, subscriptionId: string, requestId: string): Promise<SubscriptionLiveDto> {
    await this.gate.check(userId);
    await tx(this.pool, async (c) => {
      await lockUser(c, userId);
      const s = await one<{ status: string; currency: string; claimedMinor: number; lastClaimAt: Date | null; startsAt: Date | null; intervalDays: number }>(
        c,
        `SELECT s.status, s.currency, s.claimed_minor::float8 AS "claimedMinor", s.last_claim_at AS "lastClaimAt", s.starts_at AS "startsAt", p.payout_interval_days AS "intervalDays"
           FROM plan_subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.id = $1 AND s.user_id = $2 FOR UPDATE OF s`,
        [subscriptionId, userId],
      );
      if (!s) throw notFound();
      if (s.status !== "ACTIVE") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      const now = new Date();
      const base = s.lastClaimAt ?? s.startsAt;
      if (!base) throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      if (now.getTime() < base.getTime() + s.intervalDays * DAY_MS) throw state("notYet");
      const { accrued } = await persistAccrual(c, subscriptionId, now);
      const amount = Math.floor(accrued) - s.claimedMinor;
      if (amount < 1) throw state("nothingToClaim");
      await sql(c, `UPDATE plan_subscriptions SET claimed_minor = claimed_minor + $2, last_claim_at = $3, updated_at = now() WHERE id = $1`, [subscriptionId, amount, now]);
      await sql(c, `INSERT INTO subscription_payouts (subscription_id, user_id, amount_minor, currency, kind) VALUES ($1, $2, $3, $4, 'CLAIM')`, [subscriptionId, userId, amount, s.currency]);
      await post(c, { userId, currency: s.currency, kind: "PLAN_EARNINGS", refType: "SUBSCRIPTION", refId: subscriptionId, actorId: userId, legs: [{ bucket: "AVAILABLE", amount }] });
      await audit(c, { action: "subscription.claim", actorId: userId, requestId, metadata: { subscriptionId, amountMinor: amount } });
    });
    return this.live(userId, subscriptionId, null);
  }

  /* ---------- administração ---------- */

  async adminPlanStats(planId: string): Promise<AdminPlanStatsDto> {
    const plan: PlanDto = await this.plans.getForPanel(planId);
    const t = await one<{ n: number; principal: number; unclaimed: number; claimed: number }>(
      this.pool,
      `SELECT count(*) FILTER (WHERE status = 'ACTIVE')::int AS n,
              COALESCE(SUM(amount_minor) FILTER (WHERE status = 'ACTIVE'), 0)::float8 AS principal,
              COALESCE(SUM(accrued - claimed_minor) FILTER (WHERE status = 'ACTIVE'), 0)::float8 AS unclaimed,
              COALESCE(SUM(claimed_minor), 0)::float8 AS claimed
         FROM plan_subscriptions WHERE plan_id = $1`,
      [planId],
    );
    return {
      activeSubscriptions: t?.n ?? 0,
      principalMinor: t?.principal ?? 0,
      // Aproximado: a comissão acumulada é guardada de 5 em 5 minutos.
      unclaimedMinor: Math.max(0, t?.unclaimed ?? 0),
      claimedMinor: t?.claimed ?? 0,
      currentRateBps: plan.currentRateBps,
      currentChangePct: plan.currentChangePct,
      marketStale: plan.rateMode === "MARKET" && plan.marketSymbol ? await this.market.isStale("YAHOO", plan.marketSymbol) : false,
    };
  }
}
