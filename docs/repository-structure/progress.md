# KIVORA — Progresso

Um item só passa a "Testada" com evidência de execução. "Verificada em ambiente de execução" significa que foi compilada e testada num ambiente com terminal (não no GitHub do projecto).

## Lotes entregues

| Lote | Conteúdo | Estado |
|---|---|---|
| 0 | Estrutura de pastas e ficheiros (ZIP) | Implementada, importada no GitHub |
| 1 | Raiz: pnpm-workspace.yaml, package.json, tsconfig.base.json, .npmrc | Implementada |
| 2 | package.json, tsconfig.json e src/index.ts de shared e validation; package.json de config | Implementada |
| 3 | package.json das três aplicações; docs/repository-structure/CONVENTIONS.md | Implementada |
| 4 | Documentação mestre (7 ficheiros em docs/) | Implementada |
| 5 | Modelo de dados conceptual; estados e transições em packages/shared/src/states.ts | Testada (6 testes) |
| 6 | Internacionalização: languages.json e textos common e auth em pt, en, fr, es | Implementada (traduções por rever; JSON não validado por ferramenta) |
| 7 | Convenções da API: docs/api/api-conventions.md e packages/shared/src/api.ts | Compilada (TypeScript 7.0.2) e usada pela API |
| 8 | Estratégia de testes e critérios de aceitação por módulo | Implementada |
| 9 | Tokens de design: apps/web/src/styles/tokens.css e docs/frontend/design-tokens.md | Implementada (contrastes calculados; aspecto visual não verificado) |
| 10 | Inventário de dados e retenção; .env.example | Implementada |
| 11 | Decisões de infraestrutura | Implementada (nenhum fornecedor escolhido) |
| 17 | Dashboard (KIVORA.zip) integrado como página própria `/app`: CSS original intacto, ligado à sessão, perfil, definições, segurança e sessões reais; áreas sem suporte no servidor mostram "indisponível"; login passa a redirecionar para `/app/`; vercel.json com as regras da nova página | Testada: 165 testes com base de dados, 144 sem (6 shared, 6 validation, 80/59 API, 73 web); e verificada num Chromium real (fluxo completo e acessibilidade). Nunca executada na Vercel |
| 16 | Segurança da conta: listar e terminar sessões, terminar todas as outras, alterar palavra-passe (termina as outras sessões); página web `/account/security` nos 4 idiomas; limite de falhas; auditoria. Depende do lote 15 | Testada: 137 testes com base de dados, 116 sem (6 shared, 6 validation, 80/59 API, 45 web); validada por mutação. Inclui a correcção do endereço base da API na web (ver nota abaixo) |
| 15 | Persistência PostgreSQL (node-postgres) com migração SQL, executor de migrações com bloqueio e verificação de alterações, repositório PostgreSQL, arranque com base de dados e configuração por ambiente; configuração do Render (render.yaml) e da Vercel (apps/web/vercel.json); diagnóstico do IP do cliente; guia de implementação | Testada contra PostgreSQL 16 real: 101 testes com base de dados, 83 sem. Nunca executada no Render nem na Vercel |
| 14 | Aplicação web (Vite e React): login, registo, início protegido e terminar sessão ligados à API; selector de idioma no canto superior direito com pt, en, fr, es; tokens de design aplicados; PublicUser passa a contrato partilhado | Testada em jsdom: 26 testes na web (73 no total). Aspecto visual em navegador real por verificar |
| 13 | Autenticação: registo, login, sessão, logout e /me; esquemas partilhados em packages/validation (zod); palavras-passe com scrypt; sessões com cookie HttpOnly; limitação de tentativas; auditoria; esquema Prisma de autenticação | Testada com armazenamento em memória: 36 testes na API + 5 em validation + 6 em shared (47). Prisma/PostgreSQL por verificar |
| 12 | Fundação executável: dependências com versões reais e pnpm-lock.yaml; packages/shared compilável; API NestJS com /v1/health, contrato de erros, identificador de pedido, cabeçalhos de segurança, CORS, verificação de Origin e configuração validada | Testada: 19 testes passam (6 shared, 13 API) |

## Versões fixadas (verificadas no registo npm em 2026-10-19)

TypeScript 7.0.2, pnpm 12.14.0, NestJS 12.1.3 (apenas ESM), Express 5 (via Nest), helmet 8.3.0, cookie-parser 1.4.7, reflect-metadata 0.2.2, rxjs 7.8.2, zod 4.6.7, pg 8.23.1, tailwindcss e @tailwindcss/vite 4.3.3, lucide-react 1.59.0, React 19.3.1, Vite 8.3.4, react-router-dom 7.18.4, Vitest 5.0.5, @vitejs/plugin-react 6.1.2, jsdom 30.1.3. Prisma estável: 7.10.1 (a série 8 ainda está em candidata a lançamento).

## Verificado em ambiente de execução

- Instalação limpa a partir do pnpm-lock.yaml (frozen lockfile).
- Compilação de packages/shared e apps/api.
- 165 testes com base de dados e 144 sem (pnpm test na raiz; os 21 de PostgreSQL só correm com TEST_DATABASE_URL). Contra PostgreSQL 16 real: migrações (idempotência, concorrência, rollback, alteração detectada), contrato do repositório, restrições da base, corridas de registos simultâneos e fluxo HTTP completo.
- Simulação de um deploy: build a partir de cópia limpa com os comandos do Render e da Vercel, arranque em produção com migração automática, persistência após reinício, recusa de arrancar sem DATABASE_URL. Os testes de segurança foram também validados por mutação: ao partir de propósito o armazenamento do token e a verificação de suspensão, os testes falharam como esperado.
- A API arranca e responde em /v1/health.

## Não verificado

- Dashboard: o contraste de cor do CSS original não cumpre o mínimo (ver docs/frontend/dashboard-integration.md); sem indicador de foco visível; o painel administrativo não foi ligado (não existe no servidor).
- Google Fonts: o CSS original importa o tipo de letra do Google; o cabeçalho de segurança passou a permitir `fonts.googleapis.com` e `fonts.gstatic.com`. Isto envia o IP do visitante ao Google (decisão de privacidade por tomar).

- Prisma: abandonado por agora (ver docs/architecture/data-access-decision.md). prisma/schema.prisma é só referência e nunca foi validado.
- Execução real no Render e na Vercel: configuração validada contra o esquema do Render e builds simulados, mas nunca executada nas plataformas. Comportamento dos proxies (IP do cliente, tempo limite de reescritas da Vercel com a API a acordar) por verificar.
- Cabeçalho CSP da web: compatível com o HTML gerado (sem scripts nem estilos inline), mas nunca testado num navegador.
- Revisão de segurança da autenticação por um especialista: não feita.
- Aplicação web: compilada (tsc e vite build) e testada em jsdom, mas nunca aberta num navegador real. Aspecto visual, responsividade, leitores de ecrã e contraste real por rever à mão. O pré-pedido CORS foi verificado contra a API real.
- Aplicação admin: ainda sem código.
- Recuperação de acesso: a página não existe (a API ainda não tem o endpoint); a ligação "Esqueceu a palavra-passe?" não foi adicionada.
- Ficheiros JSON de internacionalização: validade não confirmada por ferramenta.
- Traduções em en, fr e es: rascunho, sem revisão por falante nativo.
- Aspecto visual dos tokens em navegadores.
- Execução no GitHub Actions ou em qualquer alojamento.

## Bloqueios

- Decisões jurídicas e financeiras (docs/compliance/open-decisions.md e docs/privacy).
- Transições de estado: proposta, a validar com o modelo financeiro.
- Campos do registo provisórios (decisões 4 e 6).
- Tipo de montante monetário por definir (decisão 7).
- Fornecedor, localização e custos de infraestrutura por decidir.

## Próxima etapa recomendada

Fazer a primeira implementação no Render e na Vercel seguindo docs/deploy/render-vercel.md e enviar os registos de qualquer falha. Depois: verificação de identidade (precisa das decisões 4, 5 e 10) e painel administrativo com permissões.

## Erro encontrado no primeiro deploy real

- Render: o build falhou por faltar `packages/shared/src/api.ts` no GitHub (um ficheiro de um lote antigo nunca foi gravado). Resolvido com um pacote de reposição. Lição: depois de cada lote, comparar a lista de ficheiros do repositório com a esperada.
- Web: em produção a página tentava falar com `http://localhost:3000` (o computador do visitante) porque a variável `VITE_API_BASE_URL` não estava definida e o valor por defeito era a API local. Sintoma: "Não foi possível contactar o serviço". Corrigido: em produção, sem variável, a web usa o próprio domínio (a Vercel reencaminha `/v1` para o Render). Há testes que o garantem.
