# KIVORA — Tokens de design

Ficheiro de origem: `apps/web/src/styles/tokens.css`. Contém apenas variáveis, sem estilos de componentes.

## Paleta oficial

| Nome | Valor | Uso |
|---|---|---|
| Azul eléctrico | #175BFF | Cor principal: botões, ligações, foco |
| Azul-marinho | #14233B | Texto e superfícies escuras |
| Amarelo | #FFD447 | Destaque, sempre como fundo |
| Branco | #FFFFFF | Fundo base |

Os tons derivados (hover, neutros e estados) foram escolhidos por mim para cumprir o contraste e podem ser ajustados.

## Contrastes calculados (fórmula WCAG)

| Combinação | Contraste |
|---|---|
| Azul-marinho sobre branco | 15,75 |
| Azul-marinho sobre cinzento muito claro (#F5F7FA) | 14,68 |
| Azul eléctrico sobre branco | 5,28 |
| Azul eléctrico sobre cinzento muito claro | 4,92 |
| Branco sobre azul eléctrico | 5,28 |
| Branco sobre azul de hover (#0F47CC) | 7,52 |
| Azul-marinho sobre amarelo | 11,07 |
| Amarelo sobre azul-marinho | 11,07 |
| Amarelo sobre branco | 1,42 (não usar) |
| Texto secundário (#566176) sobre branco | 6,24 |
| Borda de campos (#8A94A6) sobre branco | 3,06 |
| Sucesso, erro e aviso (texto) sobre branco | 6,61 / 6,54 / 7,13 |

Referência: texto normal precisa de 4,5 ou mais; componentes de interface (bordas de campos, ícones) de 3 ou mais.

## Regras de utilização

1. O amarelo nunca é cor de texto nem de ícone sobre fundo claro. Só como fundo (com texto azul-marinho) ou sobre azul-marinho.
2. Os componentes usam as variáveis semânticas (`--color-*`), nunca os valores directos da paleta.
3. Os estados (sucesso, erro, aviso) nunca se indicam só por cor. Acompanham-se sempre de texto ou de um ícone com texto alternativo.
4. O foco por teclado tem sempre um anel visível. Sobre azul-marinho usa-se o amarelo.
5. Alvos tácteis com pelo menos 44 px.
6. Fontes do sistema, sem fontes externas, por privacidade e desempenho.

## Limitações

- Não verificado: aspecto visual real em navegadores e o contraste de combinações não listadas acima.
- Sem modo escuro por agora.
- Os tokens vivem em `apps/web`. O painel administrativo vai precisar da mesma base. A decisão (partilhar através de `packages/config` ou copiar) fica para quando houver código no admin.
