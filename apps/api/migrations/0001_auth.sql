-- KIVORA — migração 0001: autenticação (utilizadores, credenciais, sessões, consentimentos, auditoria).
-- Os nomes de tabelas, colunas e tipos seguem prisma/schema.prisma, para facilitar uma adopção futura do Prisma.
-- Sem entidades financeiras (dependem das decisões 7 e 8).

CREATE TYPE user_status AS ENUM ('ACTIVE', 'LIMITED', 'SUSPENDED');
CREATE TYPE consent_document_type AS ENUM ('TERMS', 'PRIVACY');
CREATE TYPE audit_outcome AS ENUM ('SUCCESS', 'FAILURE');

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text NOT NULL,
  full_name             text NOT NULL,
  country_of_residence  char(2) NOT NULL,
  status                user_status NOT NULL DEFAULT 'ACTIVE',
  email_verified        boolean NOT NULL DEFAULT false,
  created_at            timestamptz(3) NOT NULL DEFAULT now(),
  updated_at            timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE TABLE credentials (
  user_id        uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  -- Formato scrypt$N$r$p$sal$hash. Nunca a palavra-passe em claro.
  password_hash  text NOT NULL,
  updated_at     timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- SHA-256 (hexadecimal) do token. O token em claro só existe no cookie do cliente.
  token_hash  text NOT NULL,
  created_at  timestamptz(3) NOT NULL DEFAULT now(),
  expires_at  timestamptz(3) NOT NULL,
  CONSTRAINT sessions_token_hash_key UNIQUE (token_hash)
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE consent_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  document_type     consent_document_type NOT NULL,
  -- "pending-definition" enquanto os textos legais não existirem versionados.
  document_version  text NOT NULL,
  accepted_at       timestamptz(3) NOT NULL
);
CREATE INDEX consent_records_user_id_idx ON consent_records (user_id);

CREATE TABLE audit_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action         text NOT NULL,
  actor_user_id  uuid REFERENCES users (id) ON DELETE SET NULL,
  request_id     text NOT NULL,
  outcome        audit_outcome NOT NULL,
  -- Contexto mínimo. Nunca palavras-passe, tokens ou documentos.
  metadata       jsonb,
  created_at     timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_actor_created_idx ON audit_events (actor_user_id, created_at);
CREATE INDEX audit_events_action_created_idx ON audit_events (action, created_at);
