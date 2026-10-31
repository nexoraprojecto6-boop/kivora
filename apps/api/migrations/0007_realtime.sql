-- KIVORA — migração 0007: tempo real por WebSocket.
-- Os eventos saem da própria base de dados (NOTIFY só é entregue DEPOIS do COMMIT, por isso nunca se anuncia algo que foi revertido,
-- e funciona com várias instâncias da API). O payload é pequeno e sem dados sensíveis: o cliente só recebe "o que mudou".

-- Bilhetes de ligação: uso único, 30 s, ligados a uma sessão. O WebSocket nunca leva o cookie nem o token da sessão.
CREATE TABLE realtime_tickets (
  hash          text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_hash  text NOT NULL,
  expires_at    timestamptz(3) NOT NULL
);
CREATE INDEX realtime_tickets_user_idx ON realtime_tickets (user_id);
CREATE INDEX realtime_tickets_expiry_idx ON realtime_tickets (expires_at);

CREATE OR REPLACE FUNCTION rt_emit(payload jsonb) RETURNS void LANGUAGE sql AS $$ SELECT pg_notify('kivora_rt', payload::text) $$;

-- Saldo: qualquer lançamento no livro avisa o dono (vários lançamentos na mesma transacção juntam-se num só aviso).
CREATE OR REPLACE FUNCTION rt_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM rt_emit(jsonb_build_object('k', 'wallet', 'u', NEW.user_id));
  RETURN NULL;
END $$;
CREATE TRIGGER ledger_entries_rt AFTER INSERT ON ledger_entries FOR EACH ROW EXECUTE FUNCTION rt_ledger();

-- Notificações novas.
CREATE OR REPLACE FUNCTION rt_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM rt_emit(jsonb_build_object('k', 'notification', 'u', NEW.user_id, 't', NEW.type, 'id', NEW.id));
  RETURN NULL;
END $$;
CREATE TRIGGER notifications_rt AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION rt_notification();

-- Estado dos pedidos: avisa o dono (refrescar a lista) e a equipa (fila de trabalho).
CREATE OR REPLACE FUNCTION rt_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM rt_emit(jsonb_build_object('k', 'refresh', 'u', NEW.user_id, 's', TG_ARGV[0]));
  PERFORM rt_emit(jsonb_build_object('k', 'staff', 's', TG_ARGV[0]));
  RETURN NULL;
END $$;
CREATE TRIGGER deposits_rt AFTER INSERT OR UPDATE OF status ON deposits FOR EACH ROW EXECUTE FUNCTION rt_scope('deposits');
CREATE TRIGGER withdrawals_rt AFTER INSERT OR UPDATE OF status ON withdrawals FOR EACH ROW EXECUTE FUNCTION rt_scope('withdrawals');
CREATE TRIGGER plan_subscriptions_rt AFTER INSERT OR UPDATE OF status ON plan_subscriptions FOR EACH ROW EXECUTE FUNCTION rt_scope('subscriptions');
CREATE TRIGGER subscription_payouts_rt AFTER INSERT ON subscription_payouts FOR EACH ROW EXECUTE FUNCTION rt_scope('subscriptions');
CREATE TRIGGER verification_submissions_rt AFTER INSERT OR UPDATE OF status ON verification_submissions FOR EACH ROW EXECUTE FUNCTION rt_scope('verification');
CREATE TRIGGER support_tickets_rt AFTER INSERT OR UPDATE OF status ON support_tickets FOR EACH ROW EXECUTE FUNCTION rt_scope('support');

-- Conta: estado ou email verificado mudaram.
CREATE OR REPLACE FUNCTION rt_user() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM rt_emit(jsonb_build_object('k', 'refresh', 'u', NEW.id, 's', 'account'));
  RETURN NULL;
END $$;
CREATE TRIGGER users_rt AFTER UPDATE OF status, email_verified, role ON users FOR EACH ROW EXECUTE FUNCTION rt_user();

-- Sessão terminada (logout, expiração limpa, revogação): fecha logo os WebSockets dessa sessão.
CREATE OR REPLACE FUNCTION rt_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM rt_emit(jsonb_build_object('k', 'session', 'u', OLD.user_id, 'h', OLD.token_hash));
  RETURN NULL;
END $$;
CREATE TRIGGER sessions_rt AFTER DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION rt_session();
