# Kivora – apagar planos e métodos de pagamento (admin)

Copiar por cima do repositório (mesmos caminhos). Este zip é cumulativo (inclui os dos zips anteriores).

- Admin → Planos: botão **Apagar** em cada plano. Admin → Métodos de pagamento: botão **Apagar** em cada linha.
- Pede confirmação («Apagar definitivamente»). Só o ADMIN pode (suporte e clientes recebem 403).
- **Só apaga o que nunca foi usado.** Método com depósitos/levantamentos, ou plano com subscrições, não pode ser
  apagado (o histórico e o dinheiro dos clientes dependem deles): o ecrã explica e sugere desativar o método
  («Método activo» desligado) ou pôr o plano em «Fechado»/«Rascunho». Fica registado na auditoria.
- API: `DELETE /v1/admin/payment-methods/:id` e `DELETE /v1/admin/plans/:id` (200 `{deleted:true}`, 404, 409 `inUse`).
- Novos/alterados: `DeleteDialog.tsx`, `MethodsPage.tsx`, `PlansPage.tsx`, `admin/src/lib/api.ts`,
  `admin.controllers.ts`, `payments.service.ts`, `plans.service.ts`. Sem migração nova.
