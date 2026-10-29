# Kivora – atualização do dashboard (passo 1)

Copiar a pasta `apps/` por cima do repositório (mesmos caminhos).

Ficheiros:
- apps/web/src/dashboard/App.tsx      (alterado: Início sem banner "Olá", sem resumo da conta, sem atividade recente)
- apps/web/src/dashboard/screens.tsx  (alterado: Início com carteira + convite + planos; Carteira com resumo da conta + histórico)
- apps/web/src/dashboard/invite.tsx   (novo: cartão "Convidar amigos e ganhar")
- apps/web/src/dashboard/invite.css   (novo)

Notas:
- O link de convite é `<site>/register?ref=<id do utilizador>`. Falta o servidor guardar o ?ref= no registo e
  calcular bónus/comissões (passo do backend/admin).
- Verificar se a rota de registo é mesmo `/register`; se for outra, alterar a linha `const link` em invite.tsx.
- As traduções do cartão estão dentro de invite.tsx (pt, en, es, fr) para não mexer nos JSON de idioma.
