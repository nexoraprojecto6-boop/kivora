# KIVORA

Plataforma financeira web com lançamento inicial em Angola (moeda AOA/Kz, idioma predefinido português) e arquitectura preparada para expansão internacional.

Este repositório contém, nesta fase, **apenas a estrutura de pastas e ficheiros** do monorepo. Os ficheiros de implementação estão vazios de propósito. A implementação funcional será feita numa fase posterior, após autorização expressa.

## Organização

- `apps/web` — aplicação dos clientes
- `apps/admin` — painel administrativo separado
- `apps/api` — backend
- `packages/` — tipos, validação e configurações partilhadas
- `prisma/` — base de dados (esquema, migrações, seeds, documentação)
- `infrastructure/` — deploy, monitorização, backups e ambientes
- `docs/` — documentação
- `tests/` — testes transversais
