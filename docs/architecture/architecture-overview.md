# KIVORA — Visão geral da arquitectura

## Estrutura do repositório

Os nomes das pastas são em inglês. Correspondência com o Documento Mestre (que usa nomes em português):

| Documento Mestre | Repositório |
|---|---|
| aplicativos/web | apps/web |
| aplicativos/admin | apps/admin |
| aplicativos/api | apps/api |
| pacotes/shared, validation, config | packages/shared, validation, config |
| infraestrutura | infrastructure |
| documentos | docs |
| testes | tests |

Não existe uma segunda estrutura. Ver também `docs/repository-structure/CONVENTIONS.md`.

## Tecnologias previstas

- Frontend (web e admin): React, Vite, TypeScript.
- Backend: NestJS, TypeScript.
- Base de dados: PostgreSQL, com Prisma.
- Monorepo: pnpm workspaces.
- Versões: por fixar quando for possível instalar e verificar.

## Camadas do backend

Controllers (entrada e saída HTTP), services (regras de negócio), acesso a dados (Prisma) e DTOs com validação no servidor. Tratamento centralizado de erros, configuração por ambiente, logs estruturados sem dados secretos.

## Módulos do backend

Autenticação, utilizadores, países e idiomas, verificação de identidade, documentos, planos, adesões, contratos e termos, contas, livro contabilístico, depósitos, levantamentos, integrações de pagamentos, reconciliação, notificações, referências, administração, permissões, conformidade, auditoria, suporte, tarefas agendadas, saúde e monitorização.

## Máquinas de estados (definidas no backend)

- Verificação: rascunho, pendente, em análise, aprovada ou rejeitada, com reenvio controlado.
- Depósito: criado, pendente, confirmado, rejeitado, expirado ou cancelado.
- Levantamento: solicitado, em análise, aprovado para processamento, processado ou falhado, com rejeição e cancelamento.

O estado de um pedido é distinto do estado de um lançamento contabilístico. Transições inválidas são impedidas no servidor. Operações críticas usam transacções e idempotência.

## Princípios do modelo de dados

- Montantes sem ponto flutuante binário. Representação exacta por decidir (ver decisões pendentes).
- Moeda explícita em cada montante.
- Livro contabilístico só de acréscimo. Correcções por lançamentos compensatórios.
- Aceitação de acordos ligada a uma versão imutável do documento.
- Auditoria que um administrador normal não pode apagar nem alterar.

## Decisões de arquitectura

| Decisão | Estado |
|---|---|
| Estrutura do monorepo em inglês | Decidida |
| Sem dependências até haver terminal | Decidida (temporária) |
| Mecanismo de sessão (cookies HttpOnly, Secure e SameSite, com protecção CSRF) | Proposta, por validar |
| Representação de valores monetários | Pendente |
| Formato de módulos do backend | Pendente |
| Versões das dependências | Pendente |
| Armazenamento privado de documentos | Pendente |

## Limitação actual

Nada foi instalado, compilado ou testado. Código escrito neste estado fica como "Implementada", nunca "Testada".
