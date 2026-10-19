# KIVORA — Plano de implementação

Estados: Pendente, Em implementação, Implementada, Testada, Bloqueada, A aguardar validação externa.

"Sem terminal" indica se a etapa pode avançar escrevendo ficheiros pelo GitHub, sem executar nada.

| # | Etapa | Depende de | Sem terminal | Estado |
|---|---|---|---|---|
| 1 | Auditoria da estrutura | — | Sim | Implementada |
| 2 | Plano técnico e decisões de arquitectura | 1 | Sim | Implementada (este lote) |
| 3 | Fundação do monorepo e configurações | 1 | Parcial | Em implementação |
| 4 | Aplicações web, admin e API a compilar | 3 e instalação | Não | Bloqueada (sem instalação) |
| 5 | Base de dados e estrutura inicial | decisão 7 | Parcial: modelo em papel sim, migrações não | Pendente |
| 6 | Design system e layout base | 4 | Parcial | Pendente |
| 7 | Internacionalização | 4 | Parcial: chaves e estrutura sim | Pendente |
| 8 | Autenticação e sessões | 4 e 5 | Não | Bloqueada |
| 9 | Perfis e onboarding | 8 | Não | Pendente |
| 10 | Verificação de identidade | 8, decisões 4 e 5 | Não | A aguardar validação |
| 11 | Catálogo de produtos | 5 | Não | A aguardar validação externa |
| 12 | Acordos e consentimentos | 5, decisão 2 | Não | A aguardar validação externa |
| 13 | Estrutura contabilística | decisões 7 e 8 | Não | A aguardar validação externa |
| 14 | Pedidos de depósito e levantamento (sem operações reais) | 13 | Não | Bloqueada |
| 15 | Notificações e suporte | 8 | Não | Pendente |
| 16 | Painel administrativo e auditoria | 8 | Não | Pendente |
| 17 | Testes, segurança e documentação | todas | Não | Pendente |
| 18 | Preparação de deployment e validação de produção | 17, decisão 1 | Não | Bloqueada |

## Próximos lotes sem instalação

1. Modelo de dados em papel (`prisma/docs`): entidades, relações, cardinalidades, restrições, estados.
2. Tipos TypeScript puros em `packages/shared`: enumerações de estados e transições permitidas, sem dependências.
3. Estrutura de chaves de internacionalização em `apps/web/src/i18n`, sem escrever traduções além do idioma base.

## Alterações à ordem

Nenhuma até agora.
