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

## Funcionalidades do dashboard e o que lhes falta

| Área do dashboard | Estado | O que falta no servidor | Dependências de decisão |
|---|---|---|---|
| Início, perfil (leitura), definições, segurança, sessões, alterar palavra-passe, idioma, tema, terminar sessão | **Ligado à API** | — | — |
| Edição de dados pessoais | Indisponível | PATCH do perfil e regras de campos | Decisão 4 |
| Verificação de email | Indisponível | Envio de email e endpoints de verificação | Decisão 6 |
| Notificações (lista, lidas, contador) | Indisponível | Entidade e endpoints de notificações geradas por eventos reais | — |
| Suporte e ajuda | Indisponível | Pedidos, mensagens e estados de suporte | — |
| Verificação de identidade (KYC) | Indisponível | Submissões, armazenamento privado, fila de revisão | Decisões 4, 5 e 10 |
| Planos | Indisponível | Catálogo configurável | Decisão 1 e condições comerciais aprovadas |
| Acordos e contratos | Indisponível | Textos versionados, aceitação com prova | Decisão 2 |
| Carteira, histórico de transações | Indisponível | Livro contabilístico | Decisões 7 e 8 |
| Depósitos, levantamentos | Indisponível | Pedidos, estados, idempotência, fornecedores de pagamento | Decisões 1, 3, 7 e 8 |
| Painel administrativo | Sem código | Funções, permissões e endpoints de administração | Decisão 1 e modelo de permissões |

Nada disto é simulado: onde falta suporte, o dashboard diz que a área não está disponível.
