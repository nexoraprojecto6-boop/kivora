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
| 12 | Fundação executável: dependências com versões reais e pnpm-lock.yaml; packages/shared compilável; API NestJS com /v1/health, contrato de erros, identificador de pedido, cabeçalhos de segurança, CORS, verificação de Origin e configuração validada | Testada: 19 testes passam (6 shared, 13 API) |

## Versões fixadas (verificadas no registo npm em 2026-10-19)

TypeScript 7.0.2, pnpm 12.14.0, NestJS 12.1.3 (apenas ESM), Express 5 (via Nest), helmet 8.3.0, cookie-parser 1.4.7, reflect-metadata 0.2.2, rxjs 7.8.2. Prisma estável: 7.10.1 (a série 8 ainda está em candidata a lançamento).

## Verificado em ambiente de execução

- Instalação limpa a partir do pnpm-lock.yaml (frozen lockfile).
- Compilação de packages/shared e apps/api.
- 19 testes (pnpm test na raiz).
- A API arranca e responde em /v1/health.

## Não verificado

- Prisma: o ambiente de verificação não consegue descarregar os binários do Prisma, por isso nada que dependa do Prisma foi executado.
- Aplicações web e admin: ainda sem código.
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

Autenticação (registo, login, sessão, terminar sessão) com palavras-passe em hash, sessões no servidor e cookies HttpOnly. O registo público fica desactivado por defeito até estarem definidas as decisões 4 e 6.
