-- KIVORA — migração 0009: planos simples de rendimento fixo.
-- O administrador define o preço (mínimo = máximo), o rendimento fixo por dia (ex.: 250 Kz num plano de 3 000 Kz),
-- o prazo e as condições em texto. Montantes: inteiros na menor unidade. Planos antigos (por taxa) ficam com
-- daily_yield_minor vazio e deixam de poder ser subscritos até serem configurados no painel de administração.
ALTER TABLE plans
  ADD COLUMN daily_yield_minor bigint CHECK (daily_yield_minor IS NULL OR daily_yield_minor > 0),
  ADD COLUMN conditions text NOT NULL DEFAULT '' CHECK (char_length(conditions) <= 4000);
