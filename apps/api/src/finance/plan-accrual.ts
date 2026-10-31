import type { PoolClient } from "pg";
import { one, sql, type Db } from "./sql.js";

/*
 * Motor de cálculo dos planos. Tudo corre no servidor; o frontend só mostra os resultados.
 *
 * Taxa do plano (pontos base POR DIA; 100 = 1 % ao dia):
 *   FIXED:  taxa = taxa normal.
 *   MARKET: taxa = normal + sensibilidade x variação do mercado (%), limitada entre o mínimo e o limite.
 *           Mercado em queda  -> a taxa desce até ao mínimo.
 *           Mercado em alta   -> a taxa sobe, nunca acima do limite definido pela administração.
 * A taxa é guardada como segmentos constantes no tempo (plan_rate_segments).
 *
 * Comissão de uma subscrição = soma, sobre os segmentos, de  capital x multiplicador x taxa/10000 x segundos/86400.
 * O multiplicador (bónus de convite) também é um histórico (subscription_boosts), por isso o cálculo é exacto.
 */

const SECONDS_PER_DAY = 86_400;
/** 10000 (bps) x 86400 (segundos por dia). */
const BPS_SECONDS_DIVISOR = 10_000 * SECONDS_PER_DAY;

/** Sem dados de mercado há mais do que isto: o plano usa a taxa normal. */
export function staleSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env["MARKET_STALE_SECONDS"] ?? "180");
  return Number.isInteger(n) && n >= 30 && n <= 86_400 ? n : 180;
}

export interface RateConfig {
  rateMode: "FIXED" | "MARKET";
  baseRateBps: number;
  minRateBps: number;
  maxRateBps: number;
  sensitivityBpsPerPct: number;
}

export interface RateResult {
  rateBps: number;
  limit: "MIN" | "MAX" | null;
  reason: "MARKET" | "FIXED" | "STALE";
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Função pura: taxa do plano para uma variação de mercado (em %). changePct = null quando não há dados. */
export function computeRate(cfg: RateConfig, changePct: number | null): RateResult {
  if (cfg.rateMode === "FIXED") return { rateBps: cfg.baseRateBps, limit: null, reason: "FIXED" };
  if (changePct === null || !Number.isFinite(changePct)) return { rateBps: cfg.baseRateBps, limit: null, reason: "STALE" };
  const raw = cfg.baseRateBps + cfg.sensitivityBpsPerPct * changePct;
  if (raw < cfg.minRateBps) return { rateBps: cfg.minRateBps, limit: "MIN", reason: "MARKET" };
  if (raw > cfg.maxRateBps) return { rateBps: cfg.maxRateBps, limit: "MAX", reason: "MARKET" };
  return { rateBps: round2(raw), limit: null, reason: "MARKET" };
}

/* ---------- segmentos de taxa ---------- */

interface PlanRateRow extends RateConfig {
  marketProvider: string;
  marketSymbol: string | null;
}

interface LastSegment {
  at: Date;
  rateBps: number;
  reason: string;
}

export async function latestTick(db: Db, provider: string, symbol: string): Promise<{ price: number; prevClose: number | null; at: Date } | undefined> {
  return one<{ price: number; prevClose: number | null; at: Date }>(
    db,
    `SELECT price::float8 AS price, prev_close::float8 AS "prevClose", at FROM market_ticks WHERE provider = $1 AND symbol = $2 ORDER BY at DESC LIMIT 1`,
    [provider, symbol],
  );
}

/**
 * Calcula a taxa actual do plano e, se mudou, grava um novo segmento.
 * - Dados de mercado velhos (ou em falta): taxa normal ("STALE").
 * - Servidor parado durante muito tempo: o intervalo sem dados passa à taxa normal ("GAP"), nunca fica com a taxa alta antiga.
 * - force = true (ao guardar o plano): grava logo, sem o intervalo mínimo entre segmentos.
 */
export async function evaluatePlanRate(db: Db, planId: string, force = false): Promise<void> {
  const plan = await one<PlanRateRow>(
    db,
    `SELECT rate_mode AS "rateMode", base_rate_bps AS "baseRateBps", min_rate_bps AS "minRateBps", max_rate_bps AS "maxRateBps",
            sensitivity_bps_per_pct AS "sensitivityBpsPerPct", market_provider AS "marketProvider", market_symbol AS "marketSymbol"
       FROM plans WHERE id = $1`,
    [planId],
  );
  if (!plan) return;
  const now = new Date();
  const stale = staleSeconds() * 1000;

  let price: number | null = null;
  let changePct: number | null = null;
  let tickAt: Date | null = null;
  if (plan.rateMode === "MARKET" && plan.marketSymbol) {
    const t = await latestTick(db, plan.marketProvider, plan.marketSymbol);
    if (t) tickAt = t.at;
    if (t && now.getTime() - t.at.getTime() <= stale) {
      price = t.price;
      changePct = t.prevClose !== null && t.prevClose > 0 ? ((t.price - t.prevClose) / t.prevClose) * 100 : null;
    }
  }
  const calc = computeRate(plan, changePct);

  let last = await one<LastSegment>(
    db,
    `SELECT at, rate_bps::float8 AS "rateBps", reason FROM plan_rate_segments WHERE plan_id = $1 ORDER BY at DESC LIMIT 1`,
    [planId],
  );

  // O mercado ficou sem dados (ou o servidor esteve parado): a taxa de mercado antiga deixa de valer assim que os dados
  // ficam velhos. A taxa normal conta a partir desse instante, nunca desde o último segmento (que pode ser antigo mesmo
  // com o mercado a funcionar, se o preço estiver estável).
  if (last && calc.reason === "STALE" && last.reason === "MARKET" && Math.abs(last.rateBps - plan.baseRateBps) >= 0.01) {
    const since = tickAt && tickAt.getTime() > last.at.getTime() ? tickAt : last.at;
    const gapAt = new Date(Math.min(since.getTime() + stale, now.getTime()));
    await sql(
      db,
      `INSERT INTO plan_rate_segments (plan_id, at, rate_bps, reason) VALUES ($1, $2, $3, 'GAP') ON CONFLICT (plan_id, at) DO NOTHING`,
      [planId, gapAt, plan.baseRateBps],
    );
    last = { at: gapAt, rateBps: plan.baseRateBps, reason: "GAP" };
  }

  const changed = !last || Math.abs(last.rateBps - calc.rateBps) >= 0.01;
  if (!changed) return;
  if (!force && last && now.getTime() - last.at.getTime() < 30_000) return;
  await sql(
    db,
    `INSERT INTO plan_rate_segments (plan_id, at, rate_bps, price, change_pct, reason) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (plan_id, at) DO NOTHING`,
    [planId, now, calc.rateBps, price, changePct, calc.reason],
  );
}

/* ---------- comissão ---------- */

/** Soma de (taxa em bps x segundos) do plano entre from e to. Os segmentos são constantes até ao seguinte. */
export async function bpsSeconds(db: Db, planId: string, from: Date, to: Date): Promise<number> {
  if (to.getTime() <= from.getTime()) return 0;
  const r = await one<{ v: number }>(
    db,
    `WITH segs AS (
       SELECT at AS a, rate_bps, LEAD(at) OVER (ORDER BY at) AS b
         FROM plan_rate_segments
        WHERE plan_id = $1
          AND at >= COALESCE((SELECT max(at) FROM plan_rate_segments WHERE plan_id = $1 AND at <= $2::timestamptz), '-infinity'::timestamptz)
          AND at < $3::timestamptz
     )
     SELECT COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(b, $3::timestamptz), $3::timestamptz) - GREATEST(a, $2::timestamptz)))) * rate_bps), 0)::float8 AS v
       FROM segs`,
    [planId, from, to],
  );
  return r?.v ?? 0;
}

export interface BoostStep {
  at: Date;
  m: number;
}

export async function boostSteps(db: Db, subscriptionId: string): Promise<BoostStep[]> {
  return sql<BoostStep>(db, `SELECT effective_at AS at, multiplier_x100 AS m FROM subscription_boosts WHERE subscription_id = $1 ORDER BY effective_at, id`, [subscriptionId]);
}

export function multiplierAt(steps: readonly BoostStep[], t: Date): number {
  let m = 100;
  for (const s of steps) {
    if (s.at.getTime() <= t.getTime()) m = s.m;
    else break;
  }
  return m;
}

export interface AccrualSub {
  id: string;
  planId: string;
  amountMinor: number;
}

/** Comissão gerada pela subscrição entre from e to (pode ter fracções da menor unidade). */
export async function accrueBetween(db: Db, sub: AccrualSub, from: Date, to: Date, steps?: readonly BoostStep[]): Promise<number> {
  if (to.getTime() <= from.getTime()) return 0;
  const st = steps ?? (await boostSteps(db, sub.id));
  const cuts = [from.getTime(), ...st.map((s) => s.at.getTime()).filter((t) => t > from.getTime() && t < to.getTime()), to.getTime()];
  let total = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = new Date(cuts[i] as number);
    const b = new Date(cuts[i + 1] as number);
    const bs = await bpsSeconds(db, sub.planId, a, b);
    total += (sub.amountMinor * (multiplierAt(st, a) / 100) * bs) / BPS_SECONDS_DIVISOR;
  }
  return total;
}

interface AccrualRow extends AccrualSub {
  status: string;
  accrued: number;
  accruedUpto: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** Grava na subscrição a comissão acumulada até `to` (ou até ao fim do plano). Chamar dentro de uma transacção. */
export async function persistAccrual(c: PoolClient, subscriptionId: string, to: Date): Promise<{ accrued: number }> {
  const s = await one<AccrualRow>(
    c,
    `SELECT id, plan_id AS "planId", amount_minor::float8 AS "amountMinor", status, accrued::float8 AS accrued,
            accrued_upto AS "accruedUpto", starts_at AS "startsAt", ends_at AS "endsAt"
       FROM plan_subscriptions WHERE id = $1 FOR UPDATE`,
    [subscriptionId],
  );
  if (!s) return { accrued: 0 };
  if (s.status !== "ACTIVE") return { accrued: s.accrued };
  const from = s.accruedUpto ?? s.startsAt;
  const end = s.endsAt && s.endsAt.getTime() < to.getTime() ? s.endsAt : to;
  if (!from || end.getTime() <= from.getTime()) return { accrued: s.accrued };
  const inc = await accrueBetween(c, s, from, end);
  await sql(c, `UPDATE plan_subscriptions SET accrued = accrued + $2::numeric, accrued_upto = $3, updated_at = now() WHERE id = $1`, [subscriptionId, inc.toFixed(8), end]);
  return { accrued: s.accrued + inc };
}

/* ---------- bónus de convite ---------- */

/** Convidados do utilizador com plano activo (convite activo, conta activa, convites ligados). */
export async function countQualifiedInvitees(db: Db, userId: string): Promise<number> {
  const r = await one<{ n: number }>(
    db,
    `SELECT count(*)::int AS n
       FROM referrals r JOIN users u ON u.id = r.referred_id
      WHERE r.referrer_id = $1 AND r.status = 'ACTIVE' AND u.status = 'ACTIVE'
        AND COALESCE((SELECT enabled FROM referral_settings LIMIT 1), false)
        AND EXISTS (SELECT 1 FROM plan_subscriptions x WHERE x.user_id = r.referred_id AND x.status = 'ACTIVE')`,
    [userId],
  );
  return r?.n ?? 0;
}

/** Acerta o multiplicador de todas as subscrições activas do utilizador (só acrescenta ao histórico quando muda). */
export async function refreshBoost(db: Db, userId: string): Promise<void> {
  const qualified = await countQualifiedInvitees(db, userId);
  const subs = await sql<{ id: string; boost: number; cur: number }>(
    db,
    `SELECT s.id, p.invite_boost_x100 AS boost,
            COALESCE((SELECT b.multiplier_x100 FROM subscription_boosts b WHERE b.subscription_id = s.id ORDER BY b.effective_at DESC, b.id DESC LIMIT 1), 100) AS cur
       FROM plan_subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = $1 AND s.status = 'ACTIVE'`,
    [userId],
  );
  for (const s of subs) {
    const desired = qualified > 0 && s.boost > 100 ? s.boost : 100;
    if (desired !== s.cur) {
      await sql(db, `INSERT INTO subscription_boosts (subscription_id, effective_at, multiplier_x100) VALUES ($1, now(), $2)`, [s.id, desired]);
    }
  }
}

/** Depois de um convidado activar ou terminar um plano: acerta o bónus de quem o convidou. */
export async function refreshBoostForReferrerOf(db: Db, referredUserId: string): Promise<void> {
  const r = await one<{ referrerId: string }>(db, `SELECT referrer_id AS "referrerId" FROM referrals WHERE referred_id = $1`, [referredUserId]);
  if (r) await refreshBoost(db, r.referrerId);
}

/* ---------- activação ---------- */

/**
 * Começa a contar a vida do plano: início, fim (prazo definido pela administração) e multiplicador inicial.
 * Chamar dentro da transacção que passa a subscrição a ACTIVE.
 */
export async function activateSubscription(c: PoolClient, subscriptionId: string): Promise<void> {
  const row = await one<{ userId: string; planId: string; termDays: number | null; boost: number }>(
    c,
    `SELECT s.user_id AS "userId", s.plan_id AS "planId", p.term_days AS "termDays", p.invite_boost_x100 AS boost
       FROM plan_subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.id = $1`,
    [subscriptionId],
  );
  if (!row) return;
  // Garante que existe pelo menos um segmento de taxa antes de começar a contar.
  await evaluatePlanRate(c, row.planId);
  const now = new Date();
  const endsAt = row.termDays === null ? null : new Date(now.getTime() + row.termDays * SECONDS_PER_DAY * 1000);
  await sql(c, `UPDATE plan_subscriptions SET starts_at = $2, accrued_upto = $2, ends_at = $3, updated_at = now() WHERE id = $1`, [subscriptionId, now, endsAt]);
  const qualified = await countQualifiedInvitees(c, row.userId);
  const m = qualified > 0 && row.boost > 100 ? row.boost : 100;
  await sql(c, `INSERT INTO subscription_boosts (subscription_id, effective_at, multiplier_x100) VALUES ($1, $2, $3)`, [subscriptionId, now, m]);
  await refreshBoostForReferrerOf(c, row.userId);
}
