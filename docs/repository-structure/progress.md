# KIVORA — Progresso

Um item só passa a "Testada" com evidência de execução. Sem terminal, o máximo é "Implementada".

## Lotes entregues

| Lote | Conteúdo | Estado |
|---|---|---|
| 0 | Estrutura de pastas e ficheiros (ZIP) | Implementada, importada no GitHub |
| 1 | Raiz: pnpm-workspace.yaml, package.json, tsconfig.base.json, .npmrc | Implementada |
| 2 | package.json, tsconfig.json e src/index.ts de shared e validation; package.json de config | Implementada |
| 3 | package.json das três aplicações; docs/repository-structure/CONVENTIONS.md | Implementada |
| 4 | Documentação mestre (7 ficheiros em docs/) | Implementada |
| 5 | Modelo de dados conceptual; estados e transições em packages/shared/src/states.ts | Implementada (código não compilado) |
| 6 | Internacionalização: languages.json e textos common e auth em pt, en, fr, es | Implementada (traduções por rever) |
| 7 | Convenções da API: docs/api/api-conventions.md e packages/shared/src/api.ts | Implementada (código não compilado) |
| 8 | Estratégia de testes e critérios de aceitação por módulo | Implementada |
| 9 | Tokens de design: apps/web/src/styles/tokens.css e docs/frontend/design-tokens.md | Implementada (contrastes calculados; aspecto visual não verificado) |
| 10 | Inventário de dados e retenção (docs/privacy); .env.example com nomes de variáveis | Implementada (nomes de variáveis provisórios) |

## Não verificado

- pnpm install: não executado.
- Compilação TypeScript de packages/shared (states.ts e api.ts): não executada.
- Os ficheiros JSON de internacionalização: validade não confirmada por ferramenta.
- Traduções em en, fr e es: rascunho, sem revisão por falante nativo. O português deve ser revisto para o uso em Angola.
- Aspecto visual dos tokens em navegadores.
- Qualquer teste: não existe nem foi executado.

## Bloqueios

- Instalação de dependências (decisão do responsável: fica para depois).
- Decisões jurídicas e financeiras (ver docs/compliance/open-decisions.md e docs/privacy).
- As transições de estado são uma proposta, a validar com o modelo financeiro.
- Campos do registo provisórios (decisões 4 e 6).
- Tipo de montante monetário por definir (decisão 7).
- Partilha dos tokens de design com o painel administrativo por decidir.

## Próxima etapa recomendada

Infraestrutura: documento de decisões de hospedagem, backups e ambientes (sem custos assumidos). Depois disso, o trabalho útil sem terminal esgota-se e convém activar um ambiente de execução para instalar e verificar o que já existe.
