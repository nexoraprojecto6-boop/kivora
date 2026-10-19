# KIVORA — Desenvolvimento local

Requer Node 22 ou superior e pnpm 12. Num ambiente com terminal (por exemplo GitHub Codespaces):

1. Instalar: `pnpm install --frozen-lockfile`
2. Compilar tudo: `pnpm build`
3. Correr os testes: `pnpm test`
4. Arrancar a API em desenvolvimento: `pnpm --filter @kivora/api start` (depois de `pnpm build`)

Em desenvolvimento a API usa armazenamento de autenticação em memória: os dados perdem-se ao reiniciar. Em produção a API recusa arrancar sem persistência configurada.

Para experimentar o registo localmente, definir `REGISTRATION_ENABLED=true` no ambiente (nunca em produção antes das decisões 4 e 6).

O pnpm 12 bloqueia scripts de instalação de dependências por defeito. Se uma dependência futura precisar deles (por exemplo o Prisma), é preciso aprová-la explicitamente em `pnpm-workspace.yaml`.
