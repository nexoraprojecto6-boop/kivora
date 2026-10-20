# KIVORA — Decisão: acesso à base de dados

Estado: decidida e documentada. Reversível.

## Decisão

A API acede ao PostgreSQL com **node-postgres (`pg`)** e migrações SQL próprias (`apps/api/migrations`), em vez do Prisma ORM que estava previsto.

## Porquê

- O Prisma precisa de descarregar binários no momento da instalação e da migração. No ambiente onde o código foi escrito e testado esse descarregamento está bloqueado, por isso o código com Prisma nunca poderia ser executado nem verificado antes do deploy.
- Com `pg` foi possível testar tudo contra um PostgreSQL real: migrações, transacções, corridas entre pedidos simultâneos, restrições da base de dados e o fluxo HTTP completo.
- O acesso a dados está isolado atrás da interface `AuthRepository`. Trocar de implementação não toca nas regras de negócio.

## Consequências

- As consultas são escritas à mão e parametrizadas (nunca concatenadas). Cada alteração ao esquema exige uma nova migração SQL; migrações já aplicadas não se editam (o executor verifica o SHA-256 e recusa).
- Perde-se o cliente com tipos gerados que o Prisma oferece. Compensa-se com testes de contrato que correm na implementação em memória e na PostgreSQL.
- O ficheiro `prisma/schema.prisma` fica como desenho de referência, com os mesmos nomes de tabelas e colunas.

## Caminho de volta ao Prisma

Quando existir um ambiente com acesso aos binários do Prisma: importar a base existente (`prisma db pull`), validar contra `prisma/schema.prisma`, marcar a migração 0001 como aplicada e escrever uma `PrismaAuthRepository` que passe nos mesmos testes de contrato. A decisão deve ser revista antes de modelar a parte financeira (decisões 7 e 8).
