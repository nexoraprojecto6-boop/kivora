import { randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { API_ERROR_CODE, type AdminReferralDto, type ReferralLevelDto, type ReferralOverviewDto, type ReferralSettingsDto } from "@kivora/shared";
import type { Pool, PoolClient } from "pg";
import { ApiException } from "../common/api-error.js";
import { FINANCE_CONFIG, PG_POOL, type FinanceConfig } from "./finance.config.js";
import { refreshBoost, refreshBoostForReferrerOf } from "./plan-accrual.js";
import { audit, lockUser, notify, one, post, sql, tx, type Ctx } from "./sql.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** 32 símbolos x 8 posições; 256 é múltiplo de 32, por isso não há enviesamento. */
const newCode = (): string => Array.from(randomBytes(8), (b) => CODE_ALPHABET.charAt(b % 32)).join("");

/**
 * Convidados do utilizador, estados de cada passo, ganhos e níveis. Tudo é calculado aqui, a partir das
 * tabelas reais (utilizadores, verificações, depósitos, planos): o frontend só mostra.
 *
 * Convidado "qualificado" = convite activo (não retido) + email verificado + conta verificada (KYC aprovado)
 * + depósito confirmado (mínimo definido pela administração) + plano activo. Só então há comissão, e só quando
 * o convidante já desbloqueou os ganhos (mínimo de convidados com depósito).
 */
const BASE = `
  WITH st AS (SELECT min_deposit_minor FROM referral_settings),
  base AS (
    SELECT r.id, r.referred_id, r.status, r.created_at, u.email_verified AS ev, (u.status = 'ACTIVE') AS user_active,
           EXISTS (SELECT 1 FROM verification_submissions v WHERE v.user_id = r.referred_id AND v.status = 'APPROVED') AS kyc,
           (SELECT min(COALESCE(d.decided_at, d.created_at)) FROM deposits d, st
             WHERE d.user_id = r.referred_id AND d.status = 'CONFIRMED' AND d.amount_minor >= GREATEST(st.min_deposit_minor, 1)) AS funded_at,
           (SELECT min(COALESCE(s.decided_at, s.created_at)) FROM plan_subscriptions s WHERE s.user_id = r.referred_id AND s.status = 'ACTIVE') AS subscribed_at
      FROM referrals r JOIN users u ON u.id = r.referred_id
     WHERE r.referrer_id = $1 AND r.status <> 'REJECTED'
  )`;
const QUALIFIED = `status = 'ACTIVE' AND ev AND kyc AND user_active AND funded_at IS NOT NULL AND subscribed_at IS NOT NULL`;

interface SettingsRow { enabled: boolean; commissionMinor: number; minFundedToUnlock: number; minDepositMinor: number; maxSameIp: number }

@Injectable()
export class ReferralsService {
  private readonly log = new Logger(ReferralsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(FINANCE_CONFIG) private readonly config: FinanceConfig,
  ) {}

  private async settings(db: Pool | PoolClient = this.pool): Promise<SettingsRow> {
    const s = await one<SettingsRow>(
      db,
      `SELECT enabled, commission_minor::float8 AS "commissionMinor", min_funded_to_unlock AS "minFundedToUnlock",
              min_deposit_minor::float8 AS "minDepositMinor", max_same_ip AS "maxSameIp" FROM referral_settings`,
    );
    if (!s) throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
    return s;
  }

  private levels(): Promise<ReferralLevelDto[]> {
    return sql<ReferralLevelDto>(this.pool, `SELECT level, name, min_funded AS "minFunded", yield_bonus_bps AS "yieldBonusBps" FROM referral_levels ORDER BY level`);
  }

  /** Código do utilizador (criado na primeira vez). Aleatório; nunca o id. */
  private async codeFor(userId: string): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const row = await one<{ code: string }>(this.pool, "SELECT code FROM referral_codes WHERE user_id = $1", [userId]);
      if (row) return row.code;
      await sql(this.pool, "INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, newCode()]);
    }
    throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
  }

  async overview(userId: string): Promise<ReferralOverviewDto> {
    const [st, levels, code] = await Promise.all([this.settings(), this.levels(), this.codeFor(userId)]);
    const [totals, paid, series, invites] = await Promise.all([
      one<ReferralOverviewDto["totals"]>(
        this.pool,
        `${BASE} SELECT count(*)::int AS registered,
                count(*) FILTER (WHERE ev)::int AS "emailVerified",
                count(*) FILTER (WHERE kyc)::int AS "kycVerified",
                count(*) FILTER (WHERE status = 'ACTIVE' AND funded_at IS NOT NULL)::int AS funded,
                count(*) FILTER (WHERE status = 'ACTIVE' AND subscribed_at IS NOT NULL)::int AS subscribed,
                count(*) FILTER (WHERE ${QUALIFIED})::int AS qualified,
                count(*) FILTER (WHERE status = 'FLAGGED')::int AS "inReview"
           FROM base`,
        [userId],
      ),
      one<{ paidMinor: number; n: number }>(this.pool, `SELECT COALESCE(SUM(amount_minor), 0)::float8 AS "paidMinor", count(*)::int AS n FROM referral_commissions WHERE referrer_id = $1`, [userId]),
      sql<ReferralOverviewDto["series"][number]>(
        this.pool,
        `${BASE}, days AS (SELECT generate_series(current_date - 29, current_date, interval '1 day')::date AS d)
         SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
                count(*) FILTER (WHERE b.created_at::date <= days.d)::int AS registered,
                count(*) FILTER (WHERE b.status = 'ACTIVE' AND b.funded_at::date <= days.d)::int AS funded,
                count(*) FILTER (WHERE b.status = 'ACTIVE' AND b.subscribed_at::date <= days.d)::int AS subscribed
           FROM days LEFT JOIN base b ON true GROUP BY days.d ORDER BY days.d`,
        [userId],
      ),
      sql<ReferralOverviewDto["invites"][number]>(
        this.pool,
        `${BASE} SELECT 'KV-' || upper(left(replace(b.referred_id::text, '-', ''), 8)) AS "memberCode",
                to_char(b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "joinedAt",
                b.ev AS "emailVerified", b.kyc AS "kycVerified",
                (b.status = 'ACTIVE' AND b.funded_at IS NOT NULL) AS funded,
                (b.status = 'ACTIVE' AND b.subscribed_at IS NOT NULL) AS subscribed,
                (b.status = 'FLAGGED') AS "inReview",
                c.amount_minor::float8 AS "commissionMinor"
           FROM base b LEFT JOIN referral_commissions c ON c.referral_id = b.id
          ORDER BY b.created_at DESC LIMIT 100`,
        [userId],
      ),
    ]);
    const t = totals ?? { registered: 0, emailVerified: 0, kycVerified: 0, funded: 0, subscribed: 0, qualified: 0, inReview: 0 };
    const current = [...levels].reverse().find((l) => t.funded >= l.minFunded) ?? null;
    const next = levels.find((l) => t.funded < l.minFunded) ?? null;
    const credited = paid?.n ?? 0;
    return {
      enabled: st.enabled,
      code,
      path: `/register?ref=${code}`,
      currency: this.config.currency,
      totals: t,
      earnings: { paidMinor: paid?.paidMinor ?? 0, pendingMinor: Math.max(0, t.qualified - credited) * st.commissionMinor, perInviteMinor: st.commissionMinor },
      unlock: { required: st.minFundedToUnlock, funded: t.funded, unlocked: t.funded >= st.minFundedToUnlock },
      level: { current, next, funded: t.funded },
      levels,
      series,
      invites,
    };
  }

  /* ---------- pagamento de comissões (idempotente, só no servidor) ---------- */

  /** Chamado depois de uma decisão que pode qualificar um convite (depósito, plano, verificação, email). Nunca quebra a operação principal. */
  async settleFor(referredUserId: string): Promise<void> {
    try {
      const r = await one<{ referrerId: string }>(this.pool, `SELECT referrer_id AS "referrerId" FROM referrals WHERE referred_id = $1 AND status = 'ACTIVE'`, [referredUserId]);
      if (r) await this.settleReferrer(r.referrerId, "system");
      // O convidado pode ter activado um plano: acerta o bónus de convite de quem o convidou.
      await refreshBoostForReferrerOf(this.pool, referredUserId);
    } catch (error) {
      this.log.error(`settleFor falhou: ${error instanceof Error ? error.message : "erro"}`);
    }
  }

  /**
   * Credita as comissões em falta do convidante. Seguro contra repetição e concorrência: bloqueio por utilizador
   * e um só pagamento por convidado (referral_id único). A comissão entra no livro como crédito disponível.
   */
  async settleReferrer(referrerId: string, requestId: string): Promise<number> {
    return tx(this.pool, async (c) => {
      await lockUser(c, referrerId);
      const st = await this.settings(c);
      if (!st.enabled || st.commissionMinor <= 0) return 0;
      const who = await one<{ status: string }>(c, "SELECT status FROM users WHERE id = $1", [referrerId]);
      if (who?.status !== "ACTIVE") return 0;
      const funded = await one<{ n: number }>(
        c,
        `${BASE} SELECT count(*)::int AS n FROM base WHERE status = 'ACTIVE' AND funded_at IS NOT NULL`,
        [referrerId],
      );
      if ((funded?.n ?? 0) < st.minFundedToUnlock) return 0;
      const due = await sql<{ id: string }>(
        c,
        `${BASE} SELECT b.id FROM base b WHERE ${QUALIFIED.replaceAll(/\b(status|ev|kyc|user_active|funded_at|subscribed_at)\b/g, "b.$1")}
            AND NOT EXISTS (SELECT 1 FROM referral_commissions x WHERE x.referral_id = b.id) ORDER BY b.created_at`,
        [referrerId],
      );
      let paid = 0;
      for (const d of due) {
        const ins = await one<{ id: string }>(
          c,
          `INSERT INTO referral_commissions (referral_id, referrer_id, amount_minor, currency) VALUES ($1, $2, $3, $4)
           ON CONFLICT (referral_id) DO NOTHING RETURNING id`,
          [d.id, referrerId, st.commissionMinor, this.config.currency],
        );
        if (!ins) continue;
        await post(c, { userId: referrerId, currency: this.config.currency, kind: "REFERRAL_COMMISSION", refType: "REFERRAL", refId: ins.id, actorId: null, legs: [{ bucket: "AVAILABLE", amount: st.commissionMinor }] });
        await notify(c, referrerId, "REFERRAL_COMMISSION", { amountMinor: st.commissionMinor });
        await audit(c, { action: "referral.commission", actorId: null, requestId, metadata: { commissionId: ins.id, amountMinor: st.commissionMinor } });
        paid += 1;
      }
      return paid;
    });
  }

  /* ---------- administração ---------- */

  async adminSettings(): Promise<ReferralSettingsDto> {
    return { ...(await this.settings()), levels: await this.levels() };
  }

  async adminSaveSettings(ctx: Ctx, v: SettingsRow): Promise<ReferralSettingsDto> {
    await tx(this.pool, async (c) => {
      await sql(
        c,
        `UPDATE referral_settings SET enabled = $1, commission_minor = $2, min_funded_to_unlock = $3, min_deposit_minor = $4, max_same_ip = $5, updated_by = $6, updated_at = now()`,
        [v.enabled, v.commissionMinor, v.minFundedToUnlock, v.minDepositMinor, v.maxSameIp, ctx.actorId],
      );
      await audit(c, { action: "admin.referral.settings", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { commissionMinor: v.commissionMinor, minFundedToUnlock: v.minFundedToUnlock, enabled: v.enabled } });
    });
    return this.adminSettings();
  }

  async adminSaveLevels(ctx: Ctx, levels: ReferralLevelDto[]): Promise<ReferralSettingsDto> {
    await tx(this.pool, async (c) => {
      await sql(c, "DELETE FROM referral_levels");
      for (const l of levels) await sql(c, "INSERT INTO referral_levels (level, name, min_funded, yield_bonus_bps) VALUES ($1, $2, $3, $4)", [l.level, l.name, l.minFunded, l.yieldBonusBps]);
      await audit(c, { action: "admin.referral.levels", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { count: levels.length } });
    });
    return this.adminSettings();
  }

  async adminList(status: string | null): Promise<AdminReferralDto[]> {
    return sql<AdminReferralDto>(
      this.pool,
      `SELECT r.id, r.status, r.created_at AS "createdAt", r.referrer_id AS "referrerId", a.email AS "referrerEmail", r.referred_id AS "referredId", b.email AS "referredEmail"
         FROM referrals r JOIN users a ON a.id = r.referrer_id JOIN users b ON b.id = r.referred_id
        WHERE ($1::text IS NULL OR r.status = $1) ORDER BY r.created_at DESC LIMIT 200`,
      [status],
    );
  }

  /** clear: liberta um convite retido; reject: anula-o (deixa de contar). Só a partir de FLAGGED. */
  async adminDecide(ctx: Ctx, id: string, action: "clear" | "reject"): Promise<void> {
    const referrerId = await tx(this.pool, async (c) => {
      const r = await one<{ status: string; referrerId: string }>(c, `SELECT status, referrer_id AS "referrerId" FROM referrals WHERE id = $1 FOR UPDATE`, [id]);
      if (!r) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
      if (r.status !== "FLAGGED") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      await sql(c, "UPDATE referrals SET status = $2 WHERE id = $1", [id, action === "clear" ? "ACTIVE" : "REJECTED"]);
      await audit(c, { action: `admin.referral.${action}`, actorId: ctx.actorId, requestId: ctx.requestId, metadata: { referralId: id } });
      return r.referrerId;
    });
    if (action === "clear") await this.settleReferrer(referrerId, ctx.requestId);
    // Um convite libertado ou anulado muda se o bónus de convite se aplica.
    await refreshBoost(this.pool, referrerId);
  }

  /** Reavalia todos os convidantes (por exemplo depois de mudar a comissão). Idempotente. */
  async adminReconcile(ctx: Ctx): Promise<{ referrers: number; paid: number }> {
    const rows = await sql<{ referrerId: string }>(this.pool, `SELECT DISTINCT referrer_id AS "referrerId" FROM referrals WHERE status = 'ACTIVE' LIMIT 5000`);
    let paid = 0;
    for (const r of rows) paid += await this.settleReferrer(r.referrerId, ctx.requestId);
    return { referrers: rows.length, paid };
  }
}
