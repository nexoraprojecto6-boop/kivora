# KIVORA — Implementação no Render (API e base de dados) e na Vercel (web)

Estado: a configuração foi validada contra as regras do esquema do Render e os comandos de build foram executados a partir de uma cópia limpa. **Nunca foi executada nas plataformas.** Se algum passo falhar, copia as últimas linhas do registo (log) e envia-as.

## Antes de começar

- Contas no Render e na Vercel (podes entrar com o GitHub). Ambas precisam de permissão para ler o repositório privado `kivora`.
- O registo público fica **desactivado**. Não uses dados reais de pessoas. Só dados fictícios.
- Limites (verificados na documentação do Render em 20/10/2026): a base de dados gratuita **expira 30 dias após ser criada**; o serviço gratuito **adormece após cerca de 15 minutos sem pedidos** (o primeiro pedido seguinte demora cerca de um minuto) e tem um limite mensal de horas. Não verifiquei se o plano gratuito tem cópias de segurança: assume que não.
- Não verifiquei os termos actuais da Vercel. Pelo que sei, o plano gratuito (Hobby) é para uso pessoal e não comercial. Confirma antes de usar com clientes.

## Parte 1 — Render (API e base de dados)

1. Em render.com, **New + → Blueprint**.
2. Escolhe o repositório `kivora` e o ramo `main`. O Render lê o ficheiro `render.yaml` e mostra uma base de dados (`kivora-db`) e um serviço (`kivora-api`).
3. Pede o valor de `CORS_ALLOWED_ORIGINS`. Escreve por agora `https://example.com` (vamos corrigir na Parte 3).
4. Clica **Apply**. Espera o build (alguns minutos). No separador **Logs** deves ver "Migrações: 1 aplicada(s)" e "API a ouvir na porta".
5. Abre `https://<URL-do-serviço>/v1/health`. Deve aparecer `{"data":{"status":"ok"}}`.
6. Anota o URL do serviço (aparece no topo da página do serviço, algo como `https://kivora-api.onrender.com`).

## Parte 2 — Vercel (web)

1. No GitHub, edita `apps/web/vercel.json`: na linha `destination`, troca `https://kivora-api.onrender.com` pelo URL real do Render (mantém `/v1/:path*` no fim). Grava com **Commit changes**.
2. Na Vercel, **Add New → Project** e importa o repositório `kivora`.
3. Em **Root Directory**, escolhe `apps/web`. Não alteres os comandos de build: vêm do `vercel.json`.
4. Se a Vercel mostrar a versão do Node, escolhe 22.x ou superior.
5. Clica **Deploy**. Anota o URL (`https://….vercel.app`).

## Notas sobre o dashboard (/app)

O dashboard é uma página própria em `/app/`. Depois do login a aplicação passa para lá. As regras de `apps/web/vercel.json` encaminham `/v1/...` para a API, `/app/...` para o dashboard e o resto para o login. O cabeçalho de segurança permite o Google Fonts (usado pelo CSS do dashboard).

## Parte 3 — Ligar as duas

1. No Render, serviço `kivora-api` → **Environment** → edita `CORS_ALLOWED_ORIGINS` para o URL da Vercel, **sem barra no fim** (por exemplo `https://kivora-web.vercel.app`). Grava: o Render volta a publicar.
2. Abre o URL da Vercel. Deve aparecer a página de início de sessão.

A web fala com a API pelo próprio domínio da Vercel (a Vercel reencaminha `/v1/...` para o Render). Assim o cookie de sessão pertence ao domínio da web e não há problemas de cookies entre sites diferentes.

## Parte 4 — Acertar o IP do cliente

Os limites de tentativas por IP só funcionam se a API vir o IP verdadeiro do visitante.

1. No Render, define `ENABLE_DIAGNOSTICS` = `true` e espera a publicação.
2. No telemóvel, com dados móveis (não o Wi-Fi do computador), abre `https://<URL-da-Vercel>/v1/diagnostics/client-ip`. Aparece o `ip` que a API vê e o `forwardedFor`.
3. Compara o `ip` com o teu IP público real (pesquisa "qual é o meu IP"). Se não coincidir, aumenta `TRUST_PROXY_HOPS` de 1 para 2 e repete. O esperado com a Vercel à frente do Render é 2, mas não o verifiquei.
4. Quando coincidir: define `ENABLE_DIAGNOSTICS` = `false` e baixa `LOGIN_IP_LIMIT` para 10 e `REGISTER_IP_LIMIT` para 5.

## Parte 5 — Experimentar o registo (só com dados fictícios)

No Render, define `REGISTRATION_ENABLED` = `true`, cria uma conta de teste, entra e sai. Depois volta a pôr `false`. Nunca o actives com clientes reais antes de estarem resolvidas as decisões jurídicas e de privacidade.

## Se algo correr mal

| Sintoma | O que fazer |
|---|---|
| Build falha no Render ou na Vercel | Copia as últimas 40 linhas do registo |
| Render publicado mas `/v1/health` não responde | Verifica em **Environment** que `DATABASE_URL` existe; vê os **Logs** |
| "Não foi possível contactar o serviço" | Ou a API está a acordar (abre `/v1/health` do Render, espera o `ok` e repete), ou a página publicada é anterior à correcção do endereço base (confirma que o último commit foi publicado na Vercel) |
| Erro ao entrar na primeira tentativa | Pode ser o serviço a acordar: espera um minuto e repete |
| Erro 403 ao entrar ou registar | `CORS_ALLOWED_ORIGINS` não coincide com o URL da Vercel (tem de ser `https://`, sem barra no fim) |
| Página em branco | Remove o cabeçalho `Content-Security-Policy` em `apps/web/vercel.json` para testar e diz-me |
| Dados desapareceram ao fim de 30 dias | A base gratuita expirou: é esperado no plano gratuito |

## Limitações

- Plano gratuito: arranque lento, horas limitadas, base de dados que expira e sem garantia de cópias de segurança. Adequado a testes, não a clientes.
- O site está marcado como "não indexar" (`X-Robots-Tag`). Remove esse cabeçalho no lançamento.
- Uma única instância da API: os limites de tentativas estão em memória e reiniciam com a API.
- Nada disto substitui as decisões jurídicas e de privacidade (`docs/compliance`, `docs/privacy`).
