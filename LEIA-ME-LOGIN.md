# Kivora – login novo, recuperar palavra-passe e modal «Conta em verificação»

Copiar o conteúdo do zip por cima do repositório (mesmos caminhos).

## O que mudou
**Login (/login)** – cartão centrado na horizontal e na vertical, ícone, título e subtítulo, campos maiores,
link «Esqueceu a palavra-passe?» por baixo do campo da palavra-passe, divisor «ou» e «Criar conta».
O mesmo cartão melhora o registo e a verificação (usam o mesmo `AuthLayout`).
Também corrige o botão secundário (era branco sobre branco dentro do cartão).

**Recuperar palavra-passe (/forgot-password)** – 3 passos na mesma página:
1. email → a API envia um código de 6 dígitos;
2. código + nova palavra-passe (com confirmação) → redefine;
3. concluído → botão para o login.

**Modal «Conta em verificação»** – depois de enviar bilhete + selfie, o utilizador vai para o painel e aparece
um modal por cima: «Conta em verificação · Pendente · Obrigado!». Aparece uma vez (fecha com «Entendi», Esc ou clique fora).
A faixa «Conta a verificar» no Início continua a existir.

## API (novos endpoints, sem sessão)
- `POST /v1/auth/password/forgot`  `{ email }`  → sempre `{ sent: true }` (não revela se a conta existe)
- `POST /v1/auth/password/reset`   `{ email, code, newPassword }` → `{ reset: true }`; termina todas as sessões

Regras: código de 6 dígitos válido 15 min, máx. 5 tentativas, intervalo de 60 s entre envios,
limite por IP (5 pedidos / 15 min; 15 redefinições / 15 min). Só o hash do código é guardado.
Usa o mesmo envio de email (Resend) da verificação: `RESEND_API_KEY` e `MAIL_FROM`.

## Migração
`apps/api/migrations/0007_password_reset.sql` (corre no arranque se `RUN_MIGRATIONS_ON_START=true`).

## Ficheiros
Novos: `ForgotPasswordPage.tsx`, `auth.css`, `verification-notice.ts`, `verify-pending-modal.tsx`, `verify-pending.css`,
`password-reset.service.ts`, `password-reset.controller.ts`, `0007_password_reset.sql`.
Alterados: `AuthLayout.tsx`, `LoginPage.tsx`, `VerifyPage.tsx`, `copy.ts` (textos pt/en/es/fr), `api-client.ts`,
`app/App.tsx` (rota), `main.tsx` (import do CSS), `dashboard/App.tsx` (monta o modal), `auth.module.ts` (exporta PasswordHasher), `finance.module.ts`.

## Atenção
Não executei testes nem typecheck, como pediu. Se a build falhar, envie-me o erro.
