# KIVORA — Aplicação web (clientes)

Estado: login, registo, início e terminar sessão funcionam contra a API. Testada em jsdom; nunca aberta num navegador real.

## Rotas

| Rota | Conteúdo |
|---|---|
| /login | Início de sessão, com selector de idioma no canto superior direito |
| /register | Criar conta (campos provisórios, decisões 4 e 6) |
| /dashboard | Início, protegido; só mostra dados reais da API |
| /account/security | Segurança da conta, protegida: sessões abertas (terminar uma ou todas as outras) e alterar palavra-passe |
| qualquer outra | Redirecciona para /dashboard (e daí para /login sem sessão) |

## Princípios

- O estado da sessão vem sempre do backend (`GET /v1/auth/me`). O cookie é HttpOnly: a aplicação não vê nem guarda tokens. Nada de sensível em localStorage (só a preferência de idioma).
- A protecção de rotas no frontend é apenas navegação. A autorização real é a do backend.
- Os textos estão todos no sistema de traduções (`src/i18n`), em português, inglês, francês e espanhol. Um teste garante que os 4 idiomas têm exactamente as mesmas chaves.
- A API devolve códigos de erro; a aplicação traduz. Os textos técnicos da API nunca se mostram.
- O início não mostra saldos, planos nem estatísticas: esses módulos não existem.

## Acessibilidade implementada

Etiquetas ligadas aos campos, erros ligados por `aria-describedby`, `aria-invalid`, alertas com `role="alert"`, foco no primeiro campo com erro, erros sempre com texto (não só cor), botão de mostrar palavra-passe com `aria-pressed`, alvos de 44 px, anel de foco visível, respeito por `prefers-reduced-motion`.

## Limitações

- O campo "País de residência" é um código de 2 letras. Falta decidir os países suportados.
- Não há página de recuperação de acesso (a API ainda não a suporta).
- Não há modo escuro.
- A auditoria de acessibilidade com ferramentas e a revisão em dispositivos reais por fazer.
