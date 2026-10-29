# KIVORA — Endpoints reais da API

Estado em que o código se encontra. Prefixo `/v1`. Respostas de sucesso `{ data }`, erros `{ error: { code, message, requestId, fieldErrors? } }` (ver `api-conventions.md`). Autenticação: cookie `kivora_session` (HttpOnly). Pedidos que alteram estado exigem `Origin` na lista `CORS_ALLOWED_ORIGINS`.

## Existentes

| Método e caminho | Autenticação | Entrada | Saída | Erros principais |
|---|---|---|---|---|
| GET /health | não | — | `{ status: "ok" }` | — |
| GET /diagnostics/client-ip | não (desligado por defeito: 404) | — | `{ ip, forwardedFor, trustProxyHops }` | NOT_FOUND |
| POST /auth/register | não | fullName, email, password, countryOfResidence, acceptTerms, acceptPrivacy | `{ user }` (201) | VALIDATION_ERROR, CONFLICT, RATE_LIMITED, FEATURE_DISABLED (registo desactivado por defeito) |
| POST /auth/login | não | email, password | `{ user }` e cookie | VALIDATION_ERROR, UNAUTHENTICATED, RATE_LIMITED |
| POST /auth/logout | cookie | — | `{ loggedOut: true }` | — |
| GET /auth/me | cookie | — | `{ user }` (id, email, fullName, countryOfResidence, status, emailVerified) | UNAUTHENTICATED |
| GET /auth/sessions | cookie | — | `{ sessions: [{ id, createdAt, expiresAt, current }] }` | UNAUTHENTICATED |
| DELETE /auth/sessions/:id | cookie | — | `{ revoked: true }` | UNAUTHENTICATED, NOT_FOUND |
| POST /auth/sessions/revoke-others | cookie | — | `{ revokedSessions }` | UNAUTHENTICATED |
| POST /auth/change-password | cookie | currentPassword, newPassword | `{ revokedSessions }` | VALIDATION_ERROR (campo currentPassword), RATE_LIMITED |

## Módulos operacionais (migração 0002)

Todos exigem sessão. Montantes são inteiros na menor unidade (provisório, decisão 7). Quem altera dinheiro aceita o cabeçalho `Idempotency-Key`.
Interruptores: `FINANCE_ENABLED` (por defeito falso: depósitos, levantamentos e subscrições devolvem FEATURE_DISABLED), `FINANCE_REQUIRE_KYC` (por defeito verdadeiro), `PLATFORM_CURRENCY` (AOA), `BOOTSTRAP_ADMIN_EMAIL` (promove uma conta existente a ADMIN no arranque).

| Área | Rotas |
|---|---|
| Carteira | GET /wallet, GET /transactions?kind&q&cursor, GET /payment-methods?kind |
| Depósitos | POST /deposits, GET /deposits, GET /deposits/:id, POST /deposits/:id/cancel |
| Levantamentos | POST /withdrawals (reserva o valor), GET /withdrawals, GET /withdrawals/:id, POST /withdrawals/:id/cancel |
| Planos | GET /plans, GET /plans/:id, POST /plans/:id/subscriptions, GET /subscriptions, POST /subscriptions/:id/cancel |
| Acordos | GET /agreements, POST /agreements/:versionId/accept |
| Verificação | GET /verification, POST /verification (ficheiros em base64: frente, selfie e verso opcional) |
| Notificações | GET /notifications?unread, POST /notifications/:id/read, POST /notifications/read-all |
| Suporte | GET/POST /support/tickets, GET /support/tickets/:id, POST /support/tickets/:id/messages |

## Administração (prefixo /admin, função lida da base de dados em cada pedido)

SUPPORT e ADMIN: GET /admin/summary, GET /admin/users, GET /admin/users/:id, GET /admin/support/tickets, GET /admin/support/tickets/:id, POST /admin/support/tickets/:id/messages, POST /admin/support/tickets/:id/close.

Só ADMIN: PATCH /admin/users/:id/status; GET /admin/audit; GET/POST /admin/payment-methods e PUT /admin/payment-methods/:id; GET/POST /admin/plans e PUT /admin/plans/:id; GET /admin/deposits, POST .../:id/confirm e .../:id/reject; GET /admin/withdrawals, POST .../:id/approve, .../:id/paid e .../:id/reject; GET /admin/subscriptions, POST .../:id/approve e .../:id/reject; GET/POST /admin/agreements; GET /admin/verifications, GET /admin/verifications/:id/files/:kind, POST .../:id/approve e .../:id/reject.

Regras fixas: o livro (`ledger_entries`) é só de acréscimo (gatilho na base de dados); nenhum administrador edita saldos; ninguém decide pedidos próprios; limites, comissões, métodos, planos e textos legais são dados configurados na administração, nunca valores no código.

## Ainda por fazer

| Área | Falta | Decisão |
|---|---|---|
| Edição de dados pessoais | PATCH do perfil | 4 |
| Verificação de email | envio de email | 6 |
| Pagamentos automáticos | integração com fornecedores (hoje: operação manual com confirmação da equipa) | 3 |
| Contrapartida contabilística da plataforma | plano de contas | 8 |
| Apps de administração (ecrãs) | aplicação `apps/admin` consome as rotas acima | — |
