# KIVORA — Integração do dashboard (KIVORA.zip)

## Origem e o que foi mantido

O desenho vem do ficheiro `KIVORA.zip` (projecto Figma Make: React, Vite e Tailwind). Foi mantido:

- O CSS, **byte a byte** (`apps/web/src/dashboard/index.css`, SHA-256 `fc3635d519e2a35b4cc5df74eaeab937ab8b80e309e6125e3a3d0923f526720c`, igual ao original).
- Os componentes e a estrutura dos ecrãs: Logo, IconButton, Header, ProfileDrawer, BottomNav, Page, SectionTitle, ActionTile, e as páginas Início, Perfil e Definições, com as mesmas classes CSS.
- O aspecto móvel primeiro, com a coluna lateral em ecrãs grandes e o tema claro e escuro.

## Porque é uma página própria (/app)

O CSS do dashboard define regras globais (reset do Tailwind, `.field`, `.header-actions`, barras de deslocamento, tipo de letra). Carregado na mesma página do login, alteraria o aspecto e a disposição do login e do registo, que já funcionavam (colisões verificadas: `.field` e `.header-actions`). Por isso o dashboard é uma segunda entrada da mesma aplicação (`apps/web/app/index.html`), com o seu próprio CSS. Partilha a API, a sessão (mesmo domínio, cookie HttpOnly), os idiomas e os esquemas de validação. Do login para o dashboard e de volta a navegação é completa (`window.location`).

## O que foi ligado à API real

Início (nome, estado da conta, estado do email), perfil (dados lidos de `/auth/me`), definições (idioma e tema guardados), segurança (alterar palavra-passe, sessões abertas, terminar uma ou todas as outras) e terminar sessão. O acesso exige sessão: sem ela, leva ao login.

## O que foi substituído e porquê

O desenho continha dados e promessas inventados, que não existem no servidor e que as regras do projecto proíbem: saldo e totais, planos com "rendimento estimado" de 8 a 20%, transacções, três notificações, "João Silva" como cliente verificado, métodos de pagamento, limites de levantamento, "Investimentos seguros" e gráficos de evolução. Foram substituídos por:

- Estados reais (por exemplo, "Ativa" e "Por verificar").
- Mensagens de "ainda não disponível" onde o servidor não tem o módulo (`UnavailablePage`).
- No texto de abertura do início, uma frase neutra sobre a conta, em vez de uma promessa de investimento.

Quando um módulo passar a existir no servidor (ver `docs/api/endpoints.md`), basta substituir a rota correspondente em `DashboardRoutes` pelo ecrã real.

## Diferenças em relação ao desenho

- O sino de notificações não mostra contador (não há notificações reais).
- Não há botão de ocultar valores (não há valores).
- O idioma muda em Definições (o desenho não tinha selector no cabeçalho).
- Foram acrescentados ecrãs que o desenho não tinha, com as classes do próprio CSS: dados pessoais, contactos, segurança, alterar palavra-passe e sessões.
- O interruptor de notificações em Definições está desactivado e identificado como indisponível.

## Alterações de lógica na estrutura (não são dados)

- Largura da coluna central em ecrãs grandes: o CSS original deixa-a depender do conteúdo (no desenho, as cartas de planos, cerca de 594 px). Sem esses dados inventados encolheria para metade, por isso o `App.tsx` fixa uma largura equivalente com um estilo na própria estrutura (`COLUMN_WIDTH`, 600 px). O ficheiro CSS não foi alterado. Se preferires não ter esta linha, é só apagá-la.
- A ligação "Início" da barra de baixo só fica activa em "/" (no original ficava activa em todas as páginas).
- O botão de voltar leva ao início quando não há página anterior (acesso directo por endereço).
- Atributos de acessibilidade acrescentados (ver abaixo).

## Acessibilidade (verificada com axe-core num Chromium real)

Corrigido só com lógica, sem tocar no CSS: gaveta fechada ainda focável pelo teclado (`inert`), nome acessível do botão do avatar (inclui as iniciais visíveis), título de nível 1 nas subpáginas, nome dos campos de palavra-passe sem a mensagem de erro (`aria-labelledby`).

**Por resolver (está no CSS original, não foi alterado):** contraste de cor insuficiente em todos os ecrãs.

| Cor original | Problema | Valor que cumpre o mínimo (4,5:1) |
|---|---|---|
| `--muted` `#718096` (texto de 8 a 11 px) | 3,7 a 4,0:1 | `#5b6a82` (5,0 a 5,5:1 nos três fundos) |
| `--red` `#ef4444` | 3,2 a 3,8:1 | `#c62828` (4,8 a 5,6:1) |
| `#175bff` sobre `#0e2e57` | 2,6:1 | `#7aa2ff` (5,5:1) |

Também ficaram sem indicador de foco visível: o CSS retira o contorno de `button`, `input` e `select`. Navegar com o teclado funciona, mas não se vê onde está o foco. Os tamanhos de letra de 8 a 11 px são pequenos para leitura. Estas alterações de CSS ficam à tua decisão.

## Painel administrativo

Não ficou ligado: o servidor ainda não tem funções, permissões nem endpoints de administração, e `apps/admin` não tem código. Ver `docs/api/endpoints.md`.
