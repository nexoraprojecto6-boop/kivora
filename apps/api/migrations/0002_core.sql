-- KIVORA — migração 0002: núcleo operacional (carteira, pedidos, planos, acordos, verificação, notificações, suporte, funções).
-- Tudo o que é comercial (métodos, limites, comissões, planos, textos legais) é DADO configurado por administradores:
-- nada é fixo no código (decisões 1, 2, 3, 7 e 8 continuam abertas). Montantes: inteiros na menor unidade (provisório, decisão 7).

ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'USER' CONSTRAINT users_role_check CHECK (role IN ('USER', 'SUPPORT', 'ADMIN'));

CREATE TABLE payment_methods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('DEPOSIT', 'WITHDRAWAL')),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 2000),
  min_minor   bigint CHECK (min_minor IS NULL OR min_minor > 0),
  max_minor   bigint CHECK (max_minor IS NULL OR max_minor > 0),
  fee_minor   bigint CHECK (fee_minor IS NULL OR fee_minor >= 0),
  fee_note    text NOT NULL DEFAULT '' CHECK (char_length(fee_note) <= 300),
  enabled     boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz(3) NOT NULL DEFAULT now(),
  updated_at  timestamptz(3) NOT NULL DEFAULT now()
);

-- Livro contabilístico: só de acréscimo. Um saldo é sempre a soma de lançamentos; correcções são lançamentos compensatórios.
CREATE TABLE ledger_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  bucket        text NOT NULL CHECK (bucket IN ('AVAILABLE', 'RESERVED')),
  amount_minor  bigint NOT NULL CHECK (amount_minor <> 0),
  currency      char(3) NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('DEPOSIT_CONFIRMED', 'WITHDRAWAL_RESERVE', 'WITHDRAWAL_RELEASE', 'WITHDRAWAL_PAID', 'SUBSCRIPTION_RESERVE', 'SUBSCRIPTION_RELEASE')),
  ref_type      text NOT NULL,
  ref_id        uuid NOT NULL,
  group_id      uuid NOT NULL,
  created_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_user_idx ON ledger_entries (user_id, created_at);
CREATE FUNCTION ledger_entries_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ledger_entries é só de acréscimo'; END $$;
CREATE TRIGGER ledger_entries_no_change BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();
CREATE TRIGGER ledger_entries_no_truncate BEFORE TRUNCATE ON ledger_entries FOR EACH STATEMENT EXECUTE FUNCTION ledger_entries_immutable();

CREATE TABLE deposits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  method_id        uuid NOT NULL REFERENCES payment_methods (id) ON DELETE RESTRICT,
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  currency         char(3) NOT NULL,
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
  reference        text NOT NULL UNIQUE,
  user_note        text NOT NULL DEFAULT '' CHECK (char_length(user_note) <= 300),
  idempotency_key  text,
  decided_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at       timestamptz(3),
  decision_note    text NOT NULL DEFAULT '' CHECK (char_length(decision_note) <= 500),
  created_at       timestamptz(3) NOT NULL DEFAULT now(),
  updated_at       timestamptz(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX deposits_idem_idx ON deposits (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX deposits_user_idx ON deposits (user_id, created_at DESC);
CREATE INDEX deposits_status_idx ON deposits (status, created_at);

CREATE TABLE withdrawals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  method_id        uuid NOT NULL REFERENCES payment_methods (id) ON DELETE RESTRICT,
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  currency         char(3) NOT NULL,
  destination      text NOT NULL CHECK (char_length(destination) BETWEEN 4 AND 200),
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED')),
  reference        text NOT NULL UNIQUE,
  idempotency_key  text,
  decided_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at       timestamptz(3),
  decision_note    text NOT NULL DEFAULT '' CHECK (char_length(decision_note) <= 500),
  created_at       timestamptz(3) NOT NULL DEFAULT now(),
  updated_at       timestamptz(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX withdrawals_idem_idx ON withdrawals (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX withdrawals_user_idx ON withdrawals (user_id, created_at DESC);
CREATE INDEX withdrawals_status_idx ON withdrawals (status, created_at);

CREATE TABLE plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description   text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  min_minor     bigint CHECK (min_minor IS NULL OR min_minor > 0),
  max_minor     bigint CHECK (max_minor IS NULL OR max_minor > 0),
  capacity_minor bigint CHECK (capacity_minor IS NULL OR capacity_minor > 0),
  term_days     integer CHECK (term_days IS NULL OR term_days > 0),
  risk_label    text NOT NULL DEFAULT '' CHECK (char_length(risk_label) <= 80),
  status        text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMING_SOON', 'OPEN', 'CLOSED')),
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz(3) NOT NULL DEFAULT now(),
  updated_at    timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE plan_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  plan_id          uuid NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  currency         char(3) NOT NULL,
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED')),
  reference        text NOT NULL UNIQUE,
  idempotency_key  text,
  decided_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at       timestamptz(3),
  decision_note    text NOT NULL DEFAULT '' CHECK (char_length(decision_note) <= 500),
  created_at       timestamptz(3) NOT NULL DEFAULT now(),
  updated_at       timestamptz(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plan_subscriptions_idem_idx ON plan_subscriptions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX plan_subscriptions_user_idx ON plan_subscriptions (user_id, created_at DESC);
CREATE INDEX plan_subscriptions_plan_idx ON plan_subscriptions (plan_id, status);

CREATE TABLE agreement_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL CHECK (code ~ '^[a-z][a-z0-9-]{1,39}$'),
  version       integer NOT NULL CHECK (version > 0),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 60000),
  published_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  published_at  timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT agreement_versions_code_version_key UNIQUE (code, version)
);
CREATE TABLE agreement_acceptances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  version_id   uuid NOT NULL REFERENCES agreement_versions (id) ON DELETE RESTRICT,
  accepted_at  timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT agreement_acceptances_user_version_key UNIQUE (user_id, version_id)
);

CREATE TABLE verification_submissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  doc_type          text NOT NULL CHECK (doc_type IN ('ID_CARD', 'PASSPORT', 'RESIDENCE_PERMIT')),
  issuing_country   char(2) NOT NULL,
  status            text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason  text NOT NULL DEFAULT '' CHECK (char_length(rejection_reason) <= 500),
  decided_by        uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at        timestamptz(3),
  created_at        timestamptz(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX verification_one_pending_idx ON verification_submissions (user_id) WHERE status = 'PENDING';
CREATE INDEX verification_status_idx ON verification_submissions (status, created_at);
-- Armazenamento privado provisório na própria base de dados (decisão 10). Nunca exposto fora dos endpoints de revisão.
CREATE TABLE verification_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES verification_submissions (id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('FRONT', 'BACK', 'SELFIE')),
  mime           text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes     integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 2000000),
  content        bytea NOT NULL,
  CONSTRAINT verification_files_kind_key UNIQUE (submission_id, kind)
);

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type        text NOT NULL,
  params      jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz(3),
  created_at  timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subject     text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 120),
  category    text NOT NULL CHECK (category IN ('ACCOUNT', 'DEPOSIT', 'WITHDRAWAL', 'VERIFICATION', 'OTHER')),
  status      text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ANSWERED', 'CLOSED')),
  created_at  timestamptz(3) NOT NULL DEFAULT now(),
  updated_at  timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_user_idx ON support_tickets (user_id, updated_at DESC);
CREATE INDEX support_tickets_status_idx ON support_tickets (status, updated_at);
CREATE TABLE support_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
  author_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  staff       boolean NOT NULL DEFAULT false,
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at  timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket_idx ON support_messages (ticket_id, created_at);
