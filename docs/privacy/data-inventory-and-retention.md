# KIVORA — Inventário de dados e retenção

Documento de trabalho. Não é aconselhamento jurídico nem uma política de privacidade. Serve para preparar a conversa com um advogado e para orientar o desenho técnico.

## Princípios técnicos adoptados

- Recolher só os dados necessários para cada finalidade.
- Documentos de identidade separados dos dados operacionais, em armazenamento privado.
- Nenhum dado pessoal sensível em registos (logs), mensagens de erro ou ficheiros versionados.
- Acesso a dados sensíveis só com permissão específica e deixando registo de auditoria.
- Cifra em trânsito e em repouso: planeada, ainda não implementada nem verificada.
- Consentimentos registados com versão do texto, data e hora.

## Inventário

| Categoria | Exemplos | Sensibilidade | Finalidade | Retenção |
|---|---|---|---|---|
| Conta | Email, hash da palavra-passe, estado | Média | Acesso e segurança | Por decidir |
| Perfil | Nome, país de residência, idioma | Média | Operação e conformidade | Por decidir |
| Documentos de identidade | Imagens ou ficheiros do documento | Muito alta | Verificação de identidade | Por decidir (decisão 5) |
| Dados extraídos dos documentos | Número, data de nascimento, país emissor | Muito alta | Registo da verificação | Por decidir |
| Consentimentos | Aceitação de termos e privacidade | Média | Prova de consentimento | Por decidir |
| Registos financeiros | Pedidos, lançamentos, reservas | Alta | Contabilidade e prova | Por decidir (provavelmente longa; confirmar) |
| Dados técnicos | Endereço IP, dispositivo, sessões | Média | Segurança e prevenção de fraude | Por decidir |
| Suporte | Pedidos e mensagens | Média | Atendimento | Por decidir |
| Auditoria | Acções de administradores | Alta | Controlo e prova | Por decidir |
| Notificações | Mensagens enviadas ao utilizador | Baixa | Informação ao cliente | Por decidir |

## Decisões em aberto (a levar ao advogado)

1. Que legislação de protecção de dados pessoais se aplica a uma plataforma sedeada em Angola e a clientes angolanos, e que obrigações tem (registo ou autorização junto da autoridade competente, aviso aos titulares, etc.)?
2. Que prazos mínimos de conservação se aplicam aos registos financeiros e aos documentos de identificação?
3. É admissível apagar as imagens dos documentos depois da verificação, guardando só os dados extraídos e a decisão? Com que prazo?
4. Como conciliar pedidos de eliminação de dados de um cliente com as obrigações legais de conservação?
5. Os backups também têm de respeitar os prazos de eliminação? Durante quanto tempo podem manter dados apagados?
6. Que direitos têm os clientes (acesso, correcção, eliminação, oposição) e em que prazo a empresa tem de responder?
7. Onde podem ficar alojados os dados (dentro ou fora de Angola)? Há restrições a transferências internacionais?
8. Qual a idade mínima para abrir conta e como se verifica?
9. Que texto de consentimento é exigido no registo e para o tratamento dos documentos?
10. Que obrigações existem em caso de violação de dados (prazos e entidades a notificar)?
11. Que obrigações de prevenção de branqueamento de capitais e de conhecimento do cliente se aplicam e que dados exigem?
12. Um fornecedor externo (alojamento, email, pagamentos, verificação) é subcontratante? Que contratos são necessários?

## Ligações

- Decisões gerais: `docs/compliance/open-decisions.md`.
- Protecção de documentos: `docs/document-protection/`.
- Recuperação de incidentes: `docs/incident-recovery/`.
