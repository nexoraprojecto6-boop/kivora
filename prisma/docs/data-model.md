# KIVORA — Modelo de dados (conceptual)

Documento de desenho. Não é o esquema Prisma. O esquema só se escreve depois de fechadas as decisões 7 e 8 em `docs/compliance/open-decisions.md`.

## Regras gerais

- Identificadores opacos (não sequenciais) em todas as entidades expostas.
- Datas de criação e actualização em todas as entidades.
- Montantes: nunca ponto flutuante binário. Representação exacta por decidir (decisão 7). As duas opções em avaliação: inteiros na menor unidade da moeda, ou decimal exacto com escala fixa. Em qualquer caso, a moeda acompanha sempre o montante.
- Estados de pedidos e estados contabilísticos são coisas distintas e vivem em entidades separadas.
- O livro contabilístico só recebe acréscimos. Correcções por lançamentos compensatórios que referenciam o original.
- Dados pessoais e documentos sensíveis ficam separados dos dados operacionais.

## Entidades

| Entidade | Finalidade | Relações principais | Restrições e índices principais |
|---|---|---|---|
| User | Conta de cliente ou administrador | 1 Profile, N Sessions, N ConsentRecords | Email único (normalizado); índice por estado |
| Credential | Palavra-passe (apenas hash) e factores futuros | N para 1 User | Nunca guardar texto simples |
| Session | Sessão activa | N para 1 User | Expiração; índice por utilizador |
| Profile | Dados pessoais do cliente | 1 para 1 User | País de residência obrigatório |
| Country | Países e configuração regional | referenciado por Profile e Product | Código ISO único |
| LanguagePreference | Idioma da interface por utilizador | N para 1 User | Idiomas pt, en, fr, es |
| ConsentRecord | Consentimento a termos e privacidade | N para 1 User, 1 AgreementVersion | Registo imutável; data, hora e prova técnica |
| IdentitySubmission | Submissão de verificação | N para 1 User, N DocumentMetadata | Uma submissão activa por utilizador; estado do ciclo de verificação |
| DocumentMetadata | Metadados do documento (nunca o ficheiro) | N para 1 IdentitySubmission | Localização privada; país emissor distinto do país de residência |
| Role e Permission | Funções e permissões administrativas | N para N | Menor privilégio; nenhuma função concede tudo por omissão |
| Product | Produto do catálogo | N ProductVersion, N Country | Estado de disponibilidade |
| ProductVersion | Versão imutável das condições de um produto | N para 1 Product | Nunca editada depois de publicada |
| Agreement e AgreementVersion | Acordos e as suas versões | 1 Agreement, N Versions | Versão imutável; data de vigência |
| AgreementAcceptance | Aceitação de uma versão por um cliente | User, AgreementVersion, Product | Única por utilizador, versão e produto; prova técnica |
| UserAccount | Conta contabilística do cliente (por moeda) | N para 1 User | Única por utilizador e moeda; sem campo de saldo editável |
| LedgerEntry | Lançamento contabilístico | N para 1 UserAccount; referência à origem; opcional referência ao lançamento corrigido | Só acréscimo; montante e moeda; índice por conta e data |
| AmountReservation | Montante reservado para um levantamento | 1 para 1 WithdrawalRequest | Libertação ou consumo registados |
| DepositRequest | Pedido de depósito | N para 1 User, referência de fornecedor | Chave de idempotência única; referência externa única |
| WithdrawalRequest | Pedido de levantamento | N para 1 User, 1 AmountReservation | Chave de idempotência única |
| ProviderEvent | Evento recebido de um fornecedor (webhook) | referência ao pedido | Identificador externo único; assinatura verificada; processado uma só vez |
| Notification | Notificação ao utilizador | N para 1 User | Estado de leitura; criada só por eventos reais |
| SupportTicket e SupportMessage | Pedidos de suporte e mensagens | Ticket N para 1 User; Messages N para 1 Ticket | Isolamento por utilizador |
| AuditEvent | Registo de auditoria | actor, recurso | Só acréscimo; sem segredos; não apagável por administradores normais |
| SystemSetting | Configuração do sistema | — | Alterações auditadas |

## Estados (fonte: `packages/shared/src/states.ts`)

- Verificação: draft, pending, in_review, approved, rejected.
- Depósito: created, pending, confirmed, rejected, expired, cancelled.
- Levantamento: requested, in_review, approved_for_processing, processed, failed, rejected, cancelled.
- Conta de utilizador: active, limited, suspended.

As transições estão em proposta, a validar com o modelo financeiro aprovado.

## Idempotência e concorrência

- Todo o pedido criado por um cliente leva uma chave de idempotência, única por utilizador.
- Eventos de fornecedores são deduplicados pelo identificador externo.
- Mudanças de estado e lançamentos contabilísticos ocorrem dentro de uma transacção.
- Decisões administrativas concorrentes sobre o mesmo pedido são impedidas (bloqueio ou verificação de versão).

## Pontos em aberto

- Representação de montantes (decisão 7).
- Modelo contabilístico: lançamentos simples ou partidas dobradas, e plano de contas (decisão 8).
- Retenção e eliminação de documentos (decisão 5).
- Campos definitivos do registo e do perfil (decisão 4).
