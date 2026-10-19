# KIVORA — Especificação do produto

Documento de referência. Em caso de dúvida, prevalece o Documento Mestre aprovado pelo responsável do projecto.

## Visão

Plataforma financeira web, com lançamento inicial em Angola (moeda AOA/Kz, idioma português) e arquitectura preparada para expansão internacional. Três partes: aplicação dos clientes, painel administrativo separado e backend.

## Princípio central

O backend é a única autoridade sobre saldos, permissões, estados de verificação e estados de transacções. O frontend apresenta o que a API devolve e nunca decide valores financeiros.

## Operações financeiras reais

Desactivadas até estarem validados o enquadramento jurídico, os contratos, os fornecedores de pagamento, as regras contabilísticas e os controlos de segurança. Ver `docs/compliance/open-decisions.md`.

## Perfis

- Visitante: informação pública, registo, login, termos, privacidade e informação de risco.
- Cliente registado: perfil, verificação de identidade, planos, acordos, carteira, pedidos, notificações e suporte, conforme o estado da conta.
- Administrador: painel próprio, com permissões explícitas e princípio do menor privilégio.

## Fluxo do cliente

1. Página pública (sem promessas de lucro garantido).
2. Registo, com consentimentos explícitos e registáveis.
3. Login e sessões seguras.
4. Onboarding e perfil, com estados controlados pelo backend.
5. Verificação de identidade: documentos em armazenamento privado, revisão por administrador autorizado, motivo registado.
6. Dashboard com dados reais da API. Sem saldos, lucros ou estatísticas inventados. Estados vazios quando não há dados.
7. Planos e produtos configuráveis. Só visíveis como disponíveis se configurados, aprovados e legalmente autorizados.
8. Acordos versionados, com aceitação explícita e prova técnica registada.
9. Carteira baseada em lançamentos contabilísticos. Nunca um campo de saldo livremente editável.
10. Depósitos: confirmados por mecanismo fiável (webhook autenticado ou reconciliação), nunca por clique ou captura de ecrã.
11. Levantamentos: reserva atómica, revisão, execução autorizada e evidência verificável.
12. Histórico paginado e notificações geradas por eventos reais.
13. Suporte: pedidos, mensagens e isolamento entre clientes.

## Painel administrativo

Dashboard com indicadores reais, gestão de utilizadores, fila de verificação, gestão de produtos, operações financeiras (aprovação e confirmação de pagamento são eventos distintos) e auditoria imutável para administradores normais.

## Idiomas e mercado

Idioma inicial: português. Preparados: inglês, francês e espanhol, com selector no canto superior direito do login. Quatro conceitos distintos: idioma da interface, país de residência, país emissor do documento e mercado onde o produto está legalmente disponível.

## Identidade visual

Azul eléctrico #175BFF, azul-marinho #14233B, amarelo #FFD447, branco #FFFFFF, mais neutros. Layout responsivo, acessibilidade básica, estados de carregamento, sucesso, erro, vazio e indisponibilidade. Não depender só da cor para indicar estados.

## O que não se inventa

Taxas, rendimentos, comissões, prazos, limites, regras de levantamento, métodos de pagamento, integrações com bancos ou fornecedores, estatísticas e testemunhos. O plano SILVER e o montante de 5.000 Kz foram ideias preliminares e não são regras.
