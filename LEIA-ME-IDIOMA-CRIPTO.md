# Kivora – seletor de idioma com bandeira + depósito por criptomoeda

Copiar o conteúdo do zip por cima do repositório (mesmos caminhos). Este zip é cumulativo: inclui também os
ficheiros do zip anterior (login / recuperar palavra-passe / modal de verificação) que voltaram a mudar
(`dashboard/App.tsx` tem as duas alterações).

## 1. Seletor de idioma (todas as páginas)
- Só aparece a **bandeira redonda** do idioma atual. Ao tocar abre um **painel estreito na vertical** com os idiomas
  (bandeira + nome, visto no atual). Fecha com Esc, ao tocar fora ou ao escolher; abre para cima se estiver no fundo do ecrã.
- Está no cabeçalho do login/registo/verificação/recuperação, no cabeçalho e rodapé da boas-vindas, no cabeçalho das
  páginas com sessão e **no cabeçalho do painel** (ao lado do sino). Em Definições, a lista de idiomas também mostra bandeiras.
- Bandeiras em SVG (PT, GB, FR, ES; AO incluída). Para usar a bandeira de Angola no português: `flags.tsx`, `pt: "PT"` → `"AO"`.
- Ficheiros: `components/layout/LanguageSelect.tsx`, `flags.tsx`, `language-menu.css` (novos/alterados), `WelcomePage.tsx`, `dashboard/App.tsx`.

## 2. Depósito por criptomoeda
Fluxo do cliente: Depósito → **Criptomoeda** → lista de moedas/redes com logótipo (ex.: USDT · TRON TRC20, TRX, SOL, BNB…)
→ **painel com a rede e a moeda** a depositar (aviso: só essa moeda, só essa rede) → valor → ecrã de pagamento com o
**endereço da carteira** (copiar), memo/tag se existir, prazo de 1 hora → envia **print + hash (TxID)** → «em análise»
até o administrador aprovar ou recusar (igual aos depósitos bancários; o saldo pendente aparece no painel).

Administrador (apps/admin → Métodos de pagamento → Novo método → Tipo Depósito → Serviço **Criptomoeda**):
moeda (USDT, TRX, SOL, BNB…), rede, **endereço da carteira**, memo/tag opcional, mínimo/máximo, instruções, ativo/ordem.
Só as moedas/redes ativas aparecem ao cliente. Na análise do depósito, o admin vê moeda, rede, endereço, hash e o print.

Logótipos reais: pasta `apps/web/public/crypto-icons/` (SVG do pacote cryptocurrency-icons, licença CC0): usdt, usdc, trx, sol,
bnb, btc, eth, ltc, doge, xrp, matic, dai, avax, ada, dot, link. Para outra moeda, adicionar `<símbolo>.svg` nessa pasta
(sem ficheiro aparece um círculo com as letras).

## Migração
`apps/api/migrations/0008_crypto_deposits.sql`: serviço CRYPTO, colunas `coin` e `network`, endereço até 120 caracteres
e hash da transação até 120 (Solana tem ~88). Corre no arranque se `RUN_MIGRATIONS_ON_START=true`.

## Ficheiros alterados
API: `payments.service.ts`, `schemas.ts`. Partilhado: `packages/shared/src/domain.ts` (`PaymentRail` + `coin`/`network`).
Admin: `MethodsPage.tsx`, `DepositsPage.tsx`. Web: `deposit-flow.tsx`, `crypto-deposit.tsx`, `crypto.css` (novos).

## Atenção
- O crédito é o **valor declarado em Kz** (como nos outros métodos); o cliente deve enviar o equivalente em cripto e o admin confere
  na explorer da rede antes de confirmar. Ainda não há câmbio automático (se quiser, o passo seguinte é uma taxa configurável).
- O `src/` na raiz do repositório é uma cópia antiga do admin (sem os serviços PayPay/Kwik…); alterei só `apps/admin`.
- Não executei testes nem typecheck, como pediu. Se a build falhar, envie-me o erro.
