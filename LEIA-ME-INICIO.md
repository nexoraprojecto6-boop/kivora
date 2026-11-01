# Kivora – nova página inicial (antes do login)

Copiar por cima do repositório (mesmos caminhos). Zip cumulativo (inclui os anteriores).

## O que mudou
- `features/welcome/WelcomePage.tsx` refeita como página de captação (lead page), pensada primeiro para telemóvel
  (testada em estrutura; reflui de 320 px a ecrã grande).
- **Cartão animado em SVG** (`HeroCard.tsx`): globo de pontos com negociantes a pulsar, ligações a viajar,
  anel orbital, estrelas; frase **«Somos mais de 35 milhões de negociantes no mundo»** (o 35 sobe de 0) e
  **«Operando há 23 anos»**; duas modelos a sorrir com o telemóvel (uma branca, uma negra com mochila) e
  avisos flutuantes («Conta verificada», «Saldo atualizado», «Pagamento seguro»).
- Botões **Entrar** e **Criar conta** em 3 sítios: cabeçalho fixo, topo (grandes, largura total no telemóvel) e chamada final.
- Faixa de números (35M+ / 23 anos / 4 idiomas), faixa «Deposite como preferir» (Multicaixa, PayPay, Kwik e moedas cripto
  com os logótipos reais), funcionalidades, «Como começar» e aviso de risco no rodapé.
- Animações só de transformação/opacidade, desligadas com «reduzir movimento». Textos em pt/en/es/fr (`copy.ts`, chaves `lp.*`).

## Fotografias reais (opcional)
As modelos são **ilustrações vetoriais** (não fotografias). Para usar fotos reais, ponha em `apps/web/public/welcome/`:
`model-a.webp` e `model-b.webp` (recorte com fundo transparente, 4:5, ~900×1125, até ~150 KB). Se existirem, a página usa-as
sozinha; senão fica a ilustração. Ver `public/welcome/LEIA-ME.txt`.

## Editar os números
«35 milhões» e «23 anos»: `HeroCard.tsx` (`<CountUp to={35} />`, `lp.opYears` com `n: "23"`) e `WelcomePage.tsx` (faixa de números).
Use só valores que a empresa possa comprovar.

## Ficheiros
Novos: `HeroCard.tsx`, `models.tsx`, `CountUp.tsx`, `styles/landing.css`, `public/welcome/LEIA-ME.txt`.
Alterados: `WelcomePage.tsx`, `copy.ts`, `main.tsx` (import do CSS).
