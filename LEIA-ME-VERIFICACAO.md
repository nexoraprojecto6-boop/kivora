# Kivora – registo, verificação de email e de identidade

Copiar o conteúdo do zip por cima do repositório (mesmos caminhos).

## Novo fluxo
Registo -> (sessão aberta) -> /verify: 1) código de email (6 dígitos) -> 2) bilhete frente e verso + selfie -> 3) em análise.
O utilizador pode entrar no painel; aparece a faixa "Conta a verificar" até o admin aprovar.
As fotos vão para o servidor e aparecem no painel admin (Verificações) para aprovar ou recusar (já existia).

## Variáveis de ambiente novas (API, Render)
- RESEND_API_KEY  – chave do Resend (resend.com)
- MAIL_FROM       – ex.: Kivora <no-reply@seudominio.com> (domínio verificado no Resend)
- REGISTRATION_ENABLED=true (se ainda não estiver)
Sem RESEND_API_KEY, em desenvolvimento o código aparece no log; em produção o envio falha.

## Migração
apps/api/migrations/0003_email_verification.sql (corre no arranque se RUN_MIGRATIONS estiver ativo).

## Alterações principais
API: email.controller / email-verification.service / mailer.service (novos); auth.service+controller (registo abre sessão);
verification.service (exige email verificado e verso para bilhete/autorização; passaporte dispensa verso).
Web: RegisterPage (lista de países por nome, dicas nos campos, olho dentro do campo), VerifyPage (nova), CountrySelect,
faixa no dashboard (verify-banner.tsx), /verification do painel redireciona para /verify.

## Atenção
Não executei testes nem typecheck. Os testes antigos de registo (auth.spec, auth-pages.spec) assumem que o registo
não abre sessão e mostra "Conta criada"; vão precisar de ajuste. Se a build falhar, envie-me o erro.
