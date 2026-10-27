# Dashboard Kivora corrigido

Ficheiros (pasta `apps/web/src/dashboard/`, ajusta se a tua for outra):
- `App.tsx` substitui o actual.
- `dashboard-overrides.css` é novo (já é importado por `App.tsx`). O CSS original não foi alterado.

Alterações
1. Botão "Menu" removido da barra de baixo (agora 4 ligações).
2. A gaveta lateral passou a menu em caixa no canto superior, ao clicar no avatar. Inclui as opções do dashboard e do perfil (perfil, segurança, palavra-passe, sessões, definições, terminar sessão). Fecha ao clicar fora ou com Esc. Para acrescentar opções edita o array `menuItems`.
3. Logo nas páginas azuis (painel lateral e ecrã de carregamento): sem preenchimento branco, só contorno branco de 1px (via classe `logo-outline`).
4. Backend: a lógica continua toda em `useAuth` / `authApi` (sem dados inventados).

Teste a ajustar (1 linha), em `App.test.tsx`, no teste "a barra de baixo tem as 5 ligações...":
- título: "4 ligações"
- `toEqual(["/", "/wallet", "/plans", "/notifications"])` (remove `"/profile"`)

Nota: se a `Logo` for uma `<img src="...svg">` o contorno não se aplica; nesse caso envia `brand/index.tsx` para eu ajustar o SVG.
