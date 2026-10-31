-- KIVORA — migração 0007: recuperação de palavra-passe por código de 6 dígitos enviado por email.
-- Guarda só o hash do código (nunca o código), com validade, tentativas e intervalo entre envios.
CREATE TABLE password_resets (
  user_id     uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz(3) NOT NULL,
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  sent_at     timestamptz(3) NOT NULL DEFAULT now()
);
