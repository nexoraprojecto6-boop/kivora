# Patch do dashboard Kivora

Não consegui ler o código do repositório (GitHub bloqueia acesso automático), por isso este pacote traz peças prontas a encaixar, não o projecto completo.

1. Copia `src/` para `apps/web/src/` (ou onde está o dashboard).
2. No header do dashboard: apaga o botão de menu e o estado `menuOpen`; coloca `<ProfileMenu />` no canto superior direito.
3. Logo: em todas as formas do SVG usa `fill="none" stroke="#fff" stroke-width="1"` (ver `public/logo-kivora-template.svg`). Remove qualquer `fill="#fff"`.
4. Fundo azul: usa `background: var(--kv-blue)` nas páginas.
5. Backend: só editar `src/services/session.ts` e as rotas em `DEFAULT_ITEMS`.
