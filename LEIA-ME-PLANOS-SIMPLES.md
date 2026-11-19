# Planos simples — o que mudou e como aplicar

## Como funciona agora
- **Lista**: cada plano mostra a foto, o nome e o preço.
- **Detalhe** (ao clicar): condições escritas pelo admin, prazo em destaque, rendimento por dia e botão de compra (com confirmação).
- **Depois de comprar**: painel com um único gráfico, o do rendimento de hoje, o total gerado e o botão "Enviar para a carteira".
- **Regras**: só 1 plano ativo de cada vez (conta também o que está a aguardar aprovação) e o mesmo plano nunca se compra duas vezes (ativo, a aguardar ou concluído); tem de escolher outro.
- **Planos ativos**: aparecem no topo da página Planos ("Os meus planos"). Ao clicar vê quanto gerou e pode enviar para a carteira geral (respeitando o intervalo de dias definido no plano).
- Tirados dos planos: bónus de convite, gráficos de velas, medidor de taxa, contadores por minuto/hora, mercado em tempo real.

## Cálculo (exemplo: Plano Bitcoin, 3 000 Kz, 250 Kz por dia)
- Percentagem do dia = 250 / 3 000 = **8,33 %** (não 8 %; o painel admin mostra o valor exacto enquanto escreve).
- O dia tem 24 h contadas desde a compra. O gráfico sobe do zero até aos 250 Kz com ritmos diferentes ao longo do dia, e cada dia tem um desenho próprio.
- No fim de cada dia o plano gerou **exactamente** 250 Kz; no fim do prazo, 250 x dias. O servidor e o ecrã usam a mesma função (`packages/shared/src/yield-curve.ts`), por isso o número e o gráfico batem certo.
- O bónus de convite não se aplica a estes planos (para o valor ser exactamente o definido).

## Ficheiros (copiar por cima, mantendo as pastas)
Novos:
- `packages/shared/src/yield-curve.ts`
- `apps/api/migrations/0009_fixed_yield_plans.sql` (corre sozinha no arranque da API)
- `apps/web/src/dashboard/plans-simple.tsx`
- `apps/web/src/dashboard/plans-simple.css`

Alterados:
- `packages/shared/src/index.ts`, `packages/shared/src/domain.ts`
- `apps/api/src/finance/schemas.ts`, `plans.service.ts`, `plan-accrual.ts`, `plan-earnings.service.ts`
- `apps/web/src/dashboard/screens.tsx`
- `apps/web/src/i18n/pt/dash.json`
- `apps/admin/src/pages/PlansPage.tsx`

## Pode apagar (já ninguém os usa)
`apps/web/src/dashboard/plan-panel.tsx`, `plan-panel.css`, `plans-pro.css`, `plan-text.ts`, `trade-chart.tsx`, `trend.tsx`

## Depois de publicar
1. Publicar a API (corre a migração 0009) e o web e o admin.
2. No admin, **editar cada plano existente** e preencher preço, rendimento por dia e prazo. Planos antigos (por taxa) ficam sem poder ser comprados até isso, e não se pode pôr um plano em "Aberto" sem estes três campos.
3. Os planos que já estavam ativos continuam a gerar pela regra antiga; só os planos com rendimento por dia usam a regra nova.

Nada disto foi testado no ambiente do Claude.
