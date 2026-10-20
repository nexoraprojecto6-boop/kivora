# KIVORA — Desenho da autenticação

Estado: implementado na API e testado com armazenamento em memória e com PostgreSQL real (migração `apps/api/migrations/0001_auth.sql`). Nunca executado no Render nem na Vercel.

## Endpoints (prefixo /v1)

| Método e caminho | Função | Resposta de sucesso |
|---|---|---|
| POST /auth/register | Cria conta (desactivado por defeito) | 201 `{ data: { user } }` |
| POST /auth/login | Inicia sessão e define o cookie | 200 `{ data: { user } }` |
| POST /auth/logout | Termina a sessão e limpa o cookie | 200 `{ data: { loggedOut: true } }` |
| GET /auth/me | Utilizador da sessão actual | 200 `{ data: { user } }` |

Erros seguem `docs/api/api-conventions.md`. O registo responde `FEATURE_DISABLED` enquanto `REGISTRATION_ENABLED` não for exactamente `true`.

## Palavras-passe

- Mínimo 12 e máximo 128 caracteres (o máximo evita abuso de CPU).
- Hash com scrypt (módulo nativo do Node), N=131072, r=8, p=1, sal aleatório de 16 bytes. Os parâmetros ficam no valor guardado, para os poder aumentar no futuro.
- Parâmetros baixos só existem quando NODE_ENV=test.
- Nunca se guardam, registam ou devolvem em claro.

## Sessões

- Token aleatório de 32 bytes (43 caracteres). Na base guarda-se apenas o SHA-256; o token em claro só existe no cookie.
- Duração absoluta configurável (`SESSION_TTL_HOURS`, por defeito 168 horas). Não há renovação automática.
- Cookie `kivora_session`: HttpOnly, SameSite=Lax, Path=/, Secure em produção.
- Uma conta suspensa deixa de ter sessões válidas, mesmo as já criadas.
- Nada fica em localStorage.

## Protecções

- Login: respostas idênticas para email inexistente, palavra-passe errada e conta suspensa. Faz-se sempre uma verificação de hash para o tempo de resposta não revelar se a conta existe.
- Limitação de tentativas: login 10 por IP e 5 falhas por email em 15 minutos; registo 5 por hora por IP. Resposta 429 com `Retry-After`.
- CSRF: pedidos que alteram estado com cabeçalho Origin fora da lista permitida são recusados (403). Complementa o SameSite.
- Auditoria: registo de registo, login (sucesso e falha) e logout, sem palavras-passe, tokens ou emails nas falhas.

## Limitações conhecidas

1. Os limitadores estão em memória: servem uma única instância. Com várias instâncias é preciso um armazenamento partilhado.
2. O registo com email repetido devolve CONFLICT, o que revela que o email existe. Só se resolve com verificação de email (decisão 6). O limitador reduz a enumeração em massa.
3. Sem verificação de email nem recuperação de acesso: `emailVerified` fica sempre falso.
4. Sem autenticação de dois factores.
5. Consentimentos registam o marcador de versão `pending-definition`, porque os textos legais ainda não existem.
6. Atrás de proxies (Vercel e Render), o IP do cliente só é fiável depois de acertar `TRUST_PROXY_HOPS` com o diagnóstico (`docs/deploy/render-vercel.md`). Enquanto não estiver confirmado, os limites por IP estão folgados e a protecção principal é o limite de falhas por email.
8. Não há expurgo de sessões expiradas além da limpeza horária ao criar sessões, nem política de retenção da auditoria (decisão pendente).
9. A tabela de auditoria ainda não é protegida contra alterações ao nível da base de dados.
7. A autenticação ainda não foi revista por um especialista em segurança.
