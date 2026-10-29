# Backend: o que falta para as funções pedidas

A API já tem quase tudo o que o painel precisa. Faltam **três coisas**; o painel já está escrito contra estes contratos.
As migrações abaixo são **propostas por testar** (sugestão: `apps/api/migrations/0003_admin_extras.sql`).

## 1. Comprovativo de depósito

Hoje a tabela `deposits` não guarda ficheiro nenhum, por isso não há o que analisar.

```sql
ALTER TABLE deposits
  ADD COLUMN proof_mime    text CHECK (proof_mime IN ('image/jpeg', 'image/png', 'application/pdf')),
  ADD COLUMN proof_content bytea,
  ADD COLUMN proof_at      timestamptz(3);
```

- Cliente: `POST /v1/deposits/:id/proof` com `{ mime, dataBase64 }` (mesmos limites da verificação: até ~2 MB), só enquanto o depósito está `PENDING` e é do próprio utilizador.
- Admin: `GET /v1/admin/deposits/:id/proof` → bytes com os mesmos cabeçalhos de `verifications/:id/files/:kind`
  (`Cache-Control: no-store`, `CSP: sandbox`, `nosniff`); **404** se não houver ficheiro.
- Opcional: `hasProof: boolean` no `DepositDto` para a lista mostrar um ícone.

O painel pede o ficheiro com `adminApi.depositProof(id)`; um 404 mostra «sem comprovativo».

## 2. Imagem do plano

O `planSchema` é `strictObject`, por isso a imagem **não** vai no PUT do plano; vai por rota própria.

```sql
ALTER TABLE plans
  ADD COLUMN image_mime    text CHECK (image_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  ADD COLUMN image_content bytea;
```

- `POST /v1/admin/plans/:id/image` com `{ mime, dataBase64 }` (o painel reduz a 1200 px antes de enviar) e `DELETE /v1/admin/plans/:id/image`.
- `GET /v1/plans/:id/image` (autenticado) serve os bytes com `Cache-Control: public, max-age=3600`.
- `PlanDto` ganha `imageUrl: string | null` (por exemplo `/v1/plans/<id>/image?v=<updated_at>`), em `packages/shared`.
- A CSP do `web` já permite `img-src 'self' data:`, por isso as imagens servidas pelo mesmo domínio funcionam no painel de cliente.

## 3. Rendimentos

O livro-razão só aceita estes tipos de lançamento: `DEPOSIT_CONFIRMED`, `WITHDRAWAL_*`, `SUBSCRIPTION_RESERVE`, `SUBSCRIPTION_RELEASE`.
Falta um para o rendimento:

```sql
ALTER TABLE ledger_entries DROP CONSTRAINT ledger_entries_kind_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN (
  'DEPOSIT_CONFIRMED','WITHDRAWAL_RESERVE','WITHDRAWAL_RELEASE','WITHDRAWAL_PAID',
  'SUBSCRIPTION_RESERVE','SUBSCRIPTION_RELEASE','YIELD_CREDITED'));
```

(O nome da restrição pode diferir: confirme com `\d ledger_entries` antes.)

Rotas, só ADMIN, numa transacção com `FOR UPDATE`, com auditoria e notificação ao cliente:

- `POST /v1/admin/subscriptions/:id/yield` `{ amountMinor, note }` — só subscrições `ACTIVE`; lança `+amountMinor` em `AVAILABLE` com `kind = 'YIELD_CREDITED'`, `ref_type = 'SUBSCRIPTION'`.
- `POST /v1/admin/plans/:id/yield` `{ percentBp, note }` — percentagem em pontos-base (250 = 2,50 %); para cada subscrição `ACTIVE` do plano calcula `floor(amount_minor * percentBp / 10000)` no servidor; devolve `{ applied, totalMinor }`.

Sugestão de segurança: exigir `Idempotency-Key` nestas duas rotas, para um duplo clique não pagar duas vezes.

## Decisões de negócio que o código não deve assumir

Estas ficam consigo; o painel não as fixa:

- Quando acaba o prazo de um plano, o capital volta ao saldo? Automaticamente ou por aprovação? (Hoje não há lançamento para isso.)
- O rendimento é sempre manual (como pedido) ou vai ter taxa/percentagem prometida no plano? O texto do plano e do acordo têm de bater com o que o painel aplica.
- Quem pode aplicar rendimentos: só `ADMIN` (como está) ou também um segundo aprovador?
