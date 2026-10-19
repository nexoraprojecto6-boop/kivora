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

## Não verificado

- pnpm install: não executado.
- Compilação TypeScript, incluindo packages/shared/src/states.ts: não executada.
- Os ficheiros JSON de internacionalização: validade não confirmada por ferramenta.
- Traduções em en, fr e es: rascunho, sem revisão por falante nativo. O português deve ser revisto para o uso em Angola.
- Qualquer teste: não existe nem foi executado.

## Bloqueios

- Instalação de dependências (decisão do responsável: fica para depois).
- Decisões jurídicas e financeiras (ver docs/compliance/open-decisions.md).
- As transições de estado são uma proposta, a validar com o modelo financeiro.
- Campos do registo provisórios (decisões 4 e 6).

## Próxima etapa recomendada

Convenções da API: formato de respostas e códigos de erro (tipos puros em packages/shared e documento em docs/api), sem dependências.
