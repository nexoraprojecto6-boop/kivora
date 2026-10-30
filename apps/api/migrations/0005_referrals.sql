-- KIVORA — migração 0005: convites e comunidade (códigos, convidados, comissões, níveis).
-- Tudo é calculado no servidor. Valores comerciais (comissão, mínimos, bónus dos níveis) são DADOS definidos pela administração.

-- Código de convite aleatório e não adivinhável (nunca o id do utilizador).
CREATE TABLE referral_codes (
  user_id     uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at  timestamptz(3) NOT NULL DEFAULT now()
);

-- Uma conta só pode ter UM convite (referred_id único); ninguém se convida a si próprio.
CREATE TABLE referrals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  referred_id     uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
  -- Hash do IP do registo (nunca o IP em claro): serve só para detectar contas em série.
  signup_ip_hash  text,
  -- FLAGGED: retido para análise (não conta para níveis nem comissões). REJECTED: anulado pela administração.
  status          text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FLAGGED', 'REJECTED')),
  created_at      timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referrer_id <> referred_id)
);
CREATE INDEX referrals_referrer_idx ON referrals (referrer_id, created_at DESC);
CREATE INDEX referrals_status_idx ON referrals (status, created_at);

CREATE TABLE referral_settings (
  id                    boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled               boolean NOT NULL DEFAULT true,
  -- Comissão por convite qualificado (email verificado + conta verificada + depósito + plano activo). 0 = sem comissões.
  commission_minor      bigint NOT NULL DEFAULT 0 CHECK (commission_minor >= 0),
  -- Quantos convidados com depósito são precisos para desbloquear os ganhos.
  min_funded_to_unlock  integer NOT NULL DEFAULT 3 CHECK (min_funded_to_unlock >= 1),
  -- Depósito mínimo (um só depósito confirmado) para o convidado contar como "depositou".
  min_deposit_minor     bigint NOT NULL DEFAULT 0 CHECK (min_deposit_minor >= 0),
  -- Registos do mesmo IP no mesmo convidante acima deste número ficam retidos para análise.
  max_same_ip           integer NOT NULL DEFAULT 2 CHECK (max_same_ip >= 1),
  updated_by            uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at            timestamptz(3) NOT NULL DEFAULT now()
);
INSERT INTO referral_settings DEFAULT VALUES;

-- Níveis da comunidade: quanto mais convidados com depósito, maior o bónus de rendimento (em pontos base: 100 = 1 %).
CREATE TABLE referral_levels (
  level            integer PRIMARY KEY CHECK (level BETWEEN 1 AND 20),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  min_funded       integer NOT NULL CHECK (min_funded >= 1),
  yield_bonus_bps  integer NOT NULL DEFAULT 0 CHECK (yield_bonus_bps BETWEEN 0 AND 10000)
);
-- Limiares e nomes iniciais; o bónus fica a 0 até a administração o definir.
INSERT INTO referral_levels (level, name, min_funded) VALUES (1, 'Semente', 3), (2, 'Rede', 10), (3, 'Comunidade', 25), (4, 'Embaixador', 50);

-- Uma comissão por convidado, no máximo (referral_id único = sem pagamentos duplicados).
CREATE TABLE referral_commissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id   uuid NOT NULL UNIQUE REFERENCES referrals (id) ON DELETE RESTRICT,
  referrer_id   uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amount_minor  bigint NOT NULL CHECK (amount_minor > 0),
  currency      char(3) NOT NULL,
  created_at    timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX referral_commissions_referrer_idx ON referral_commissions (referrer_id, created_at DESC);

-- A comissão entra no livro contabilístico (só de acréscimo) como crédito disponível.
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_kind_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN
  ('DEPOSIT_CONFIRMED', 'WITHDRAWAL_RESERVE', 'WITHDRAWAL_RELEASE', 'WITHDRAWAL_PAID', 'SUBSCRIPTION_RESERVE', 'SUBSCRIPTION_RELEASE', 'REFERRAL_COMMISSION'));
