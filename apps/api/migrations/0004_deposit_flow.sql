-- KIVORA — migração 0004: fluxo de depósito (conta do parceiro por serviço, prazo de 1 hora, comprovativo e contas do cliente).

-- Dados de pagamento que o administrador define em cada método de depósito.
ALTER TABLE payment_methods
  ADD COLUMN rail            text CHECK (rail IN ('PAYPAY', 'KWIK', 'EXPRESS', 'REFERENCIA')),
  ADD COLUMN account_holder  text NOT NULL DEFAULT '' CHECK (char_length(account_holder) <= 120),
  ADD COLUMN account_number  text NOT NULL DEFAULT '' CHECK (char_length(account_number) <= 60),
  ADD COLUMN entity          text NOT NULL DEFAULT '' CHECK (char_length(entity) <= 20),
  ADD COLUMN reference       text NOT NULL DEFAULT '' CHECK (char_length(reference) <= 40);

-- Um depósito sem comprovativo expira 1 hora depois de criado.
ALTER TABLE deposits
  ADD COLUMN expires_at          timestamptz(3) NOT NULL DEFAULT (now() + interval '1 hour'),
  ADD COLUMN tx_id               text NOT NULL DEFAULT '' CHECK (char_length(tx_id) <= 60),
  ADD COLUMN proof_submitted_at  timestamptz(3);
-- Depósitos pendentes que já existiam continuam visíveis para análise.
UPDATE deposits SET proof_submitted_at = created_at WHERE status = 'PENDING';

CREATE TABLE deposit_proofs (
  deposit_id  uuid PRIMARY KEY REFERENCES deposits (id) ON DELETE CASCADE,
  mime        text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes  integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 2000000),
  content     bytea NOT NULL
);

-- Contas do próprio cliente (PayPay, Kwik, Express), guardadas para depósitos e levantamentos futuros.
CREATE TABLE user_payment_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rail        text NOT NULL CHECK (rail IN ('PAYPAY', 'KWIK', 'EXPRESS')),
  holder      text NOT NULL CHECK (char_length(holder) BETWEEN 2 AND 120),
  detail      text NOT NULL CHECK (char_length(detail) BETWEEN 3 AND 60),
  created_at  timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT user_payment_accounts_unique UNIQUE (user_id, rail, detail)
);
CREATE INDEX user_payment_accounts_user_idx ON user_payment_accounts (user_id, created_at);
