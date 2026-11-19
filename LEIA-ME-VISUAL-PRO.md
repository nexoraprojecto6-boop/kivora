# Visual profissional + saque simples + verificação obrigatória

Este ZIP é acumulado: inclui também os ficheiros dos planos simples (ZIP anterior). Copie tudo por cima, mantendo as pastas.

## O que mudou
- **Letra**: Inter, base 16 px, peso normal 500. Todos os tamanhos minúsculos (7 a 11 px) subiram para 12 a 14 px; botões e campos a 16 px (também evita o zoom automático no iPhone).
- **Bordas**: 1,5 px, mais escuras (claro e escuro), mesmo raio em cartões, campos e botões, e sombra suave nos cartões.
- **Cartões**: saldo com «vidro» nos números secundários, movimentos mais altos e legíveis, atalhos maiores, estados com contorno.
- **Animações** (biblioteca `motion`): entrada suave de cada página, lista de planos a aparecer em cascata, saldo que corre até ao novo valor, passos do saque com deslize, ecrã de sucesso com visto animado. Respeita «reduzir movimento» do sistema.
- **Vidro**: barra de navegação, faixa de verificação, cartão de saldo e boas-vindas (feito com CSS `backdrop-filter`, sem biblioteca extra).
- **Boas-vindas**: ao iniciar sessão (ou criar conta) aparece um ecrã rápido com «Bem-vindo» e o primeiro nome. Toca para saltar. Só uma vez por login.
- **Verificação obrigatória**: faixa fixa no topo de TODAS as páginas enquanto o email não estiver confirmado ou a identidade não estiver aprovada («Por verificar», «Verificação pendente», «Recusada»). Depósitos, levantamentos e compra de planos ficam bloqueados até aprovar; a página mostra o motivo e o botão para continuar.
- **Levantamento em passos**: 1 Valor (campo grande, 25 % / 50 % / 75 % / Tudo, erro na hora), 2 Destino (cartões grandes, escolhido sozinho se só houver um), 3 Confirmar (resumo), e ecrã de sucesso. Se só houver um destino, ficam 2 passos.
- **Planos**: cartões com foto que dá zoom ao passar, nome e preço maiores, tudo com o mesmo acabamento.

## Ficheiros novos
`apps/web/src/dashboard/`: `motion-kit.tsx`, `ui-pro.css`, `welcome-splash.tsx/.css`, `verify-topbar.tsx/.css`, `require-verified.tsx`, `withdraw-flow.tsx/.css`, `plans-simple.tsx/.css`; `apps/web/src/services/welcome.ts`; `packages/shared/src/yield-curve.ts`; `apps/api/migrations/0009_fixed_yield_plans.sql`.

## Dependência nova
`motion` (^14.14.0) em `apps/web/package.json`. O `pnpm-lock.yaml` vai atualizado neste ZIP: **copie-o também**, senão o deploy com `--frozen-lockfile` falha.

## Pode apagar
`apps/web/src/dashboard/`: `plan-panel.tsx`, `plan-panel.css`, `plans-pro.css`, `plan-text.ts`, `trade-chart.tsx`, `trend.tsx`, `verify-banner.tsx` (só o componente `VerifyBanner`; `VerifyRedirect` continua em uso, por isso **não apague este ficheiro**).

## Notas
- A verificação obrigatória no ecrã é uma barreira de interface. A barreira real é do servidor: mantenha «exigir verificação» ligado nas definições do admin.
- Não foi testado no ambiente do Claude. Se o `pnpm test` do web falhar em algum teste de ecrã, envie-me o erro.
