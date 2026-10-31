# Kivora — Painel profissional dos planos (lote)

Copiar esta pasta por cima do repositório (mesmos caminhos). Nada foi executado nem testado no ambiente de criação:
fazer `pnpm install`, `pnpm typecheck` e `pnpm test` antes de publicar e corrigir o que o compilador indicar.

## Ficheiros
Novos (apps/web/src/dashboard/): `plan-cover.tsx`, `trade-chart.tsx`, `trend.tsx`, `plan-text.ts`, `plans-pro.css`
Alterados: `plan-panel.tsx`, `screens.tsx`, `apps/api/src/finance/market.service.ts` (1 linha)
O `index.css` original não foi alterado.

## O que muda
1. Gráfico do mercado estilo trading: velas ou linha, intervalos 1m / 5m / 15m / 1h, arrastar para ver o histórico,
   zoom, cursor com A / Máx / Mín / F, linha do preço actual com etiqueta, vela e ponto a piscar. Só desenha os pontos
   que o servidor guardou (nada inventado). O servidor passa a entregar ≈ 24 h de histórico ao abrir (antes 180 pontos).
2. Gráfico da comissão (barras) com a mesma moldura do gráfico do mercado, para ficarem alinhados (lado a lado em ecrãs largos).
3. Setas verde/vermelha a piscar: percentagem de agora, comissão por minuto/hora/dia, preço do mercado e barras de comissão.
   Direcção = último movimento visto; ao abrir, taxa acima/abaixo da normal (ou sinal da variação do mercado).
4. Painel escuro com leituras em células planas (sem aspecto de botão), comissão total em destaque, medidor da taxa
   (mínima / normal / limite) e botão "Enviar para a carteira" rectangular.
5. Capa/foto do plano em todas as vistas: cartões do início, lista de planos, "Os meus planos" (miniatura), detalhe e painel.
   Sem foto (ou se falhar) mostra o desenho de reserva.
6. Cantos retos nos cartões, botões, campos e filtros das páginas dos planos.

## Notas
- Só o painel do plano é escuro; o detalhe (antes de investir) segue o tema claro/escuro da app, com cantos retos.
- A moldura dos gráficos tem as mesmas margens nos dois; mexer em `W/H/ML/MR/MT/MB` no topo de `trade-chart.tsx` muda ambos.
- Os preços continuam a vir do Yahoo Finance (ver LEIA-ME-PLANOS.md); com o servidor adormecido há menos pontos no histórico.
- Textos novos em pt/en/es/fr em `plan-text.ts`.
