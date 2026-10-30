-- KIVORA — migração 0003: verificação de email por código de 6 dígitos.
-- Guarda só o hash do código (nunca o código), com validade, tentativas e intervalo entre envios.
CREATE TABLE email_verifications (
  user_id     uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz(3) NOT NULL,
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  sent_at     timestamptz(3) NOT NULL DEFAULT now()
);
