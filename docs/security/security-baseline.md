# KIVORA — Linha de base de segurança

Estado de cada controlo: Planeado, Implementado ou Verificado. Nada está Verificado até haver execução e testes reais.

## Controlos

| Área | Controlo | Estado |
|---|---|---|
| Credenciais | Hash seguro de palavras-passe; nunca texto simples | Planeado |
| Sessões | Cookies HttpOnly, Secure, SameSite; sem tokens de longa duração em localStorage sem análise | Planeado |
| Pedidos | Protecção CSRF e XSS; CORS restritivo | Planeado |
| Abuso | Rate limiting no login e recuperação de acesso | Planeado |
| Contas | Mensagens que não revelam se uma conta existe | Planeado |
| Entradas | Validação no cliente e sempre no servidor | Planeado |
| Autorização | Verificada no backend em cada operação sensível, nunca só no frontend | Planeado |
| Administração | Aplicação separada, autenticação própria, menor privilégio | Planeado |
| Documentos | Armazenamento privado, validação de ficheiros, acesso só a pessoas autorizadas | Planeado |
| Dinheiro | O frontend nunca decide saldos nem confirma transacções; idempotência em pedidos | Planeado |
| Auditoria | Acções críticas registadas (ator, acção, recurso, data, resultado); sem segredos nos registos | Planeado |
| Segredos | Fora do repositório; `.env.example` só com nomes de variáveis | Implementado (estrutura) |
| Dependências | Revisão e análise periódicas | Planeado |
| Continuidade | Backups, recuperação, monitorização | Planeado |

## Regras permanentes

- Nunca fazer commit de credenciais, chaves, documentos pessoais ou dados reais.
- Nunca usar dados reais de clientes em testes ou exemplos.
- Nunca guardar documentos ou tokens em pastas públicas, logs ou ficheiros versionados.
- Não se afirma que a plataforma é segura ou invulnerável. Documentam-se riscos e controlos.

## Riscos conhecidos

- Sem testes executados, qualquer controlo escrito não está verificado.
- Retenção e eliminação de documentos de identidade dependem de decisão legal (ver decisões pendentes).
