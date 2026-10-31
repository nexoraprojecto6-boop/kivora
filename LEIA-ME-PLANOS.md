# Kivora — Planos com painel em tempo real (lote)

Copiar esta pasta por cima do repositório (mesmos caminhos). Nada foi executado nem testado no ambiente de criação:
fazer `pnpm install`, `pnpm typecheck` e `pnpm test` antes de publicar e corrigir o que o compilador indicar.

## O que faz
- Cliente: clica no plano -> foto grande, título, descrição, como funciona, riscos, valor de entrada, percentagem diária
  (normal / mínima / limite) e, por baixo, "Investir". Ao investir aparece o loader e abre o painel do plano.
- Painel (`/app/subscriptions/:id`): gráfico do mercado em tempo real, percentagem de agora, comissão gerada
  (total, por minuto/hora/dia e gráfico de barras), prazo restante, bónus de convite, levantamento para a carteira.
- Tudo é calculado e validado no servidor (migração 0006 + `apps/api/src/finance/plan-*.ts`, `market.service.ts`).
  O frontend só mostra; o único cálculo local é visual (contador a avançar entre dois pedidos de 5 s).
- Admin (Planos -> editar): imagem, como funciona, riscos, tipo de percentagem (fixa ou segue o mercado), símbolo do
  mercado, normal/mínima/limite, sensibilidade, prazo, levantamento de N em N dias, bónus de convite (2 = dobra),
  activação automática.

## Regras de cálculo (servidor)
- Percentagens em pontos base por dia (100 = 1 %/dia).
- Mercado: taxa = normal + sensibilidade x variação% do dia, sempre entre mínima e limite.
  Mercado em queda -> desce até à mínima; em alta -> sobe até ao limite. Sem dados recentes -> taxa normal.
- Comissão = capital x multiplicador x taxa x tempo (integração por segmentos de taxa).
- Bónus de convite: com um convidado que tenha plano activo, a taxa é multiplicada (por omissão x2); só vale para
  o tempo em que o convidado tem plano activo.
- Levantamento: só a cada N dias definidos no plano; o valor é calculado no servidor (o pedido não leva montante);
  vai para o saldo disponível da carteira. No fim do prazo o servidor fecha o plano, paga a comissão em falta e devolve o capital.

## Variáveis de ambiente novas (todas opcionais)
- `MARKET_POLL_SECONDS` (20) intervalo de leitura do mercado; `MARKET_POLL_ENABLED=false` desliga.
- `MARKET_STALE_SECONDS` (180) a partir de quando o mercado conta como sem dados.
- `PLAN_JOBS_ENABLED=false` desliga as tarefas de fundo (fim de plano, acumulação).

## Atenção
1. A migração `0006_plan_market.sql` corre no arranque (RUN_MIGRATIONS_ON_START=true). Fazer cópia da base de dados antes.
2. Subscrições já activas começam a gerar comissão a partir da migração, e só depois de o plano ter percentagem > 0.
3. Os preços vêm do endpoint público do Yahoo Finance (sem chave, não oficial, pode atrasar ou bloquear). Para produção
   séria, trocar `fetchYahooQuote` em `market.service.ts` por um fornecedor pago.
4. O Render free adormece: sem servidor ligado não há leitura de mercado nem fecho de planos; ao acordar o servidor
   regulariza (taxa normal nos intervalos sem dados, fim de plano pago na altura). Usar plano pago ou um ping.
5. Rendimento/comissão a pagar é responsabilidade financeira da plataforma: confirmar enquadramento jurídico antes de
   ligar `FINANCE_ENABLED=true`. O botão antigo "Rendimento" por subscrição (Admin -> Subscrições) continua a apontar
   para rotas que não existem; remover ou implementar.
6. Só o português foi traduzido nas chaves novas do JSON (en/es/fr já caíam para pt); o painel novo tem os 4 idiomas.
