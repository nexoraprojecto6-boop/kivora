-- KIVORA — migração 0008: depósitos por criptomoeda (moeda + rede + endereço definidos pelo administrador).

-- Novo serviço CRYPTO e endereço de carteira mais comprido (o IBAN/telefone continuam a caber).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'payment_methods'::regclass AND contype = 'c'
       AND (pg_get_constraintdef(oid) LIKE '%rail%' OR pg_get_constraintdef(oid) LIKE '%account_number%')
  LOOP
    EXECUTE format('ALTER TABLE payment_methods DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE payment_methods
  ADD CONSTRAINT payment_methods_rail_check CHECK (rail IS NULL OR rail IN ('PAYPAY', 'KWIK', 'EXPRESS', 'REFERENCIA', 'CRYPTO')),
  ADD CONSTRAINT payment_methods_account_number_check CHECK (char_length(account_number) <= 120),
  ADD COLUMN coin     text NOT NULL DEFAULT '' CHECK (char_length(coin) <= 12),
  ADD COLUMN network  text NOT NULL DEFAULT '' CHECK (char_length(network) <= 60);

-- O hash de uma transacção cripto pode ter mais de 60 caracteres (Solana: ~88).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'deposits'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%tx_id%'
  LOOP
    EXECUTE format('ALTER TABLE deposits DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE deposits ADD CONSTRAINT deposits_tx_id_check CHECK (char_length(tx_id) <= 120);
