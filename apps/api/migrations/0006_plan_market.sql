-- KIVORA — migração 0006: planos com painel, mercado em tempo real, taxa diária calculada no servidor,
-- bónus de convite, levantamento periódico da comissão do plano e prazo de expiração.
-- Tudo o que é comercial (taxas, limites, mercado, prazo, periodicidade, bónus) é DADO definido pela administração.
-- Taxas em pontos base POR DIA: 100 = 1 % ao dia.

/* ---------- Planos: conteúdo, imagem, mercado e taxas ---------- */
ALTER TABLE plans
  ADD COLUMN image_mime   text CHECK (image_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  ADD COLUMN image_content bytea,
  ADD COLUMN how_it_works text NOT NULL DEFAULT '' CHECK (char_length(how_it_works) <= 6000),
  ADD COLUMN risk_details text NOT NULL DEFAULT '' CHECK (char_length(risk_details) <= 4000),
  -- Mercado de referência do gráfico e do cálculo (símbolo do fornecedor; ex.: EURUSD=X, AAPL, ^GSPC).
  ADD COLUMN market_provider text NOT NULL DEFAULT 'YAHOO' CHECK (market_provider IN ('YAHOO')),
  ADD COLUMN market_symbol   text CHECK (market_symbol IS NULL OR market_symbol ~ '^[A-Za-z0-9.=^_-]{1,24}$'),
  ADD COLUMN market_label    text NOT NULL DEFAULT '' CHECK (char_length(market_label) <= 60),
  -- FIXED: a taxa é sempre a taxa normal. MARKET: a taxa sobe/desce com o mercado, entre o mínimo e o limite.
  ADD COLUMN rate_mode text NOT NULL DEFAULT 'FIXED' CHECK (rate_mode IN ('FIXED', 'MARKET')),
  ADD COLUMN base_rate_bps integer NOT NULL DEFAULT 0 CHECK (base_rate_bps BETWEEN 0 AND 10000),
  ADD COLUMN min_rate_bps  integer NOT NULL DEFAULT 0 CHECK (min_rate_bps BETWEEN 0 AND 10000),
  ADD COLUMN max_rate_bps  integer NOT NULL DEFAULT 0 CHECK (max_rate_bps BETWEEN 0 AND 10000),
  -- Quantos pontos base por dia a taxa muda por cada 1 % de variação do mercado face ao fecho anterior.
  ADD COLUMN sensitivity_bps_per_pct integer NOT NULL DEFAULT 0 CHECK (sensitivity_bps_per_pct BETWEEN 0 AND 10000),
  -- De quantos em quantos dias o cliente pode levantar a comissão do plano (1 = diário, 3, 7 = semanal...).
  ADD COLUMN payout_interval_days integer NOT NULL DEFAULT 1 CHECK (payout_interval_days BETWEEN 1 AND 90),
  -- Multiplicador da taxa quando um convidado do cliente tem plano activo (x100: 200 = dobra; 100 = sem bónus).
  ADD COLUMN invite_boost_x100 integer NOT NULL DEFAULT 200 CHECK (invite_boost_x100 BETWEEN 100 AND 1000),
  -- Se verdadeiro, a subscrição fica activa logo (sem aprovação manual).
  ADD COLUMN auto_activate boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT plans_rate_order_check CHECK (min_rate_bps <= base_rate_bps AND base_rate_bps <= max_rate_bps),
  ADD CONSTRAINT plans_market_needs_symbol_check CHECK (rate_mode = 'FIXED' OR market_symbol IS NOT NULL);

/* ---------- Subscrições: vida do plano, comissão acumulada e levantamentos ---------- */
-- Remove o CHECK do estado seja qual for o nome, e volta a criá-lo com COMPLETED (plano terminado).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'plan_subscriptions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE plan_subscriptions DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE plan_subscriptions
  ADD CONSTRAINT plan_subscriptions_status_check CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED', 'COMPLETED')),
  ADD COLUMN starts_at     timestamptz(3),
  ADD COLUMN ends_at       timestamptz(3),
  ADD COLUMN completed_at  timestamptz(3),
  -- Comissão acumulada até accrued_upto (o resto calcula-se a partir dos segmentos de taxa).
  ADD COLUMN accrued       numeric(30, 8) NOT NULL DEFAULT 0 CHECK (accrued >= 0),
  ADD COLUMN accrued_upto  timestamptz(3),
  -- Parte da comissão já enviada para a carteira (inteiros na menor unidade).
  ADD COLUMN claimed_minor bigint NOT NULL DEFAULT 0 CHECK (claimed_minor >= 0),
  ADD COLUMN last_claim_at timestamptz(3);
CREATE INDEX plan_subscriptions_active_idx ON plan_subscriptions (status, ends_at) WHERE status = 'ACTIVE';

-- Subscrições já activas antes desta migração: começam a contar daqui (sem pagamentos retroactivos).
UPDATE plan_subscriptions s
   SET starts_at = COALESCE(s.decided_at, s.created_at),
       accrued_upto = now(),
       ends_at = CASE WHEN p.term_days IS NULL THEN NULL ELSE COALESCE(s.decided_at, s.created_at) + (p.term_days || ' days')::interval END
  FROM plans p
 WHERE p.id = s.plan_id AND s.status = 'ACTIVE';

/* ---------- Mercado em tempo real (guardado no servidor) ---------- */
CREATE TABLE market_ticks (
  id          bigserial PRIMARY KEY,
  provider    text NOT NULL,
  symbol      text NOT NULL,
  price       numeric(24, 8) NOT NULL CHECK (price > 0),
  prev_close  numeric(24, 8) CHECK (prev_close IS NULL OR prev_close > 0),
  at          timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX market_ticks_symbol_idx ON market_ticks (provider, symbol, at DESC);

/* ---------- Taxa diária do plano ao longo do tempo (segmentos constantes) ---------- */
-- A taxa de um plano é constante entre dois segmentos. A comissão é a soma de capital x taxa x tempo sobre estes segmentos.
CREATE TABLE plan_rate_segments (
  id          bigserial PRIMARY KEY,
  plan_id     uuid NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  at          timestamptz(3) NOT NULL,
  rate_bps    numeric(12, 4) NOT NULL CHECK (rate_bps >= 0),
  price       numeric(24, 8),
  change_pct  numeric(12, 6),
  -- MARKET (calculada pelo mercado), FIXED, STALE (sem dados de mercado: taxa normal), GAP (servidor parado: taxa normal)
  reason      text NOT NULL CHECK (reason IN ('MARKET', 'FIXED', 'STALE', 'GAP')),
  CONSTRAINT plan_rate_segments_plan_at_key UNIQUE (plan_id, at)
);

/* ---------- Bónus de convite por subscrição (histórico, só de acréscimo) ---------- */
CREATE TABLE subscription_boosts (
  id               bigserial PRIMARY KEY,
  subscription_id  uuid NOT NULL REFERENCES plan_subscriptions (id) ON DELETE CASCADE,
  effective_at     timestamptz(3) NOT NULL,
  multiplier_x100  integer NOT NULL CHECK (multiplier_x100 BETWEEN 100 AND 1000)
);
CREATE INDEX subscription_boosts_sub_idx ON subscription_boosts (subscription_id, effective_at);

/* ---------- Levantamentos da comissão do plano para a carteira ---------- */
CREATE TABLE subscription_payouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid NOT NULL REFERENCES plan_subscriptions (id) ON DELETE RESTRICT,
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  currency         char(3) NOT NULL,
  -- CLAIM: pedido pelo cliente. EXPIRY: pago automaticamente quando o plano termina.
  kind             text NOT NULL CHECK (kind IN ('CLAIM', 'EXPIRY')),
  created_at       timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX subscription_payouts_sub_idx ON subscription_payouts (subscription_id, created_at DESC);

/* ---------- Livro contabilístico: novo tipo de lançamento ---------- */
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_kind_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN
  ('DEPOSIT_CONFIRMED', 'WITHDRAWAL_RESERVE', 'WITHDRAWAL_RELEASE', 'WITHDRAWAL_PAID', 'SUBSCRIPTION_RESERVE', 'SUBSCRIPTION_RELEASE', 'REFERRAL_COMMISSION', 'PLAN_EARNINGS'));
