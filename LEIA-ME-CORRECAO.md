# Correção da build (Vercel e Render)

Causa: o último zip (página inicial) substituiu 3 ficheiros por versões antigas e apagou as alterações do WebSocket:
- apps/web/src/services/api-client.ts (faltavam realtimeSocketUrl, realtimeTicket e o argumento de referrals)
- apps/web/src/dashboard/App.tsx (faltava a ligação ao tempo real)
- apps/api/src/finance/finance.module.ts (faltava registar o serviço e o controlador de tempo real)

Este zip repõe esses 3 ficheiros (versão do vosso commit anterior) e corrige o pnpm-lock.yaml, que não tinha o `ws`
(o Render usa --frozen-lockfile e falharia). A página inicial e o resto ficam como estão.
Copiar por cima do repositório e fazer commit.
