# KIVORA — Desenvolvimento local

Requer Node 22 ou superior e pnpm 12. Num ambiente com terminal (por exemplo GitHub Codespaces):

1. Instalar: `pnpm install --frozen-lockfile`
2. Compilar tudo: `pnpm build`
3. Correr os testes: `pnpm test`
4. Arrancar a API em desenvolvimento (depois de `pnpm build`), por exemplo:
   `API_PORT=3000 CORS_ALLOWED_ORIGINS=http://localhost:5173 REGISTRATION_ENABLED=true pnpm --filter @kivora/api start`
5. Noutro terminal, arrancar a aplicação web: `pnpm --filter @kivora/web dev` e abrir http://localhost:5173
   (a web fala com a API em http://localhost:3000; para mudar, definir `VITE_API_BASE_URL`).

Em desenvolvimento a API usa armazenamento de autenticação em memória: os dados perdem-se ao reiniciar. Em produção a API recusa arrancar sem persistência configurada.

Para experimentar o registo localmente, definir `REGISTRATION_ENABLED=true` no ambiente (nunca em produção antes das decisões 4 e 6).

O pnpm 12 bloqueia scripts de instalação de dependências por defeito. Se uma dependência futura precisar deles (por exemplo o Prisma), é preciso aprová-la explicitamente em `pnpm-workspace.yaml`.
