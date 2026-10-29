# KIVORA Admin — como instalar (sem correr nada localmente)

Este ZIP contém **só o painel administrativo** (`apps/admin`): ecrãs, componentes e a ligação à API real que já está no Render.
Nada foi executado nem testado; a primeira verificação é o *build* da Vercel.

## 1. Gravar os ficheiros no repositório

1. Extraia o ZIP. A pasta `apps/admin` substitui a que existe no repositório (que só tinha `package.json`, `tsconfig.json` e `README.md`).
2. No GitHub (web), na pasta `apps/admin`, use **Add file → Upload files** e arraste o conteúdo de `apps/admin` (mantendo `src/`, `docs/`).
   O `package.json` e o `tsconfig.json` existentes são substituídos.
3. Faça *commit* em `main`.

## 2. Criar o projecto na Vercel (separado do `web`)

- **Add New → Project** → o mesmo repositório `kivora`.
- **Root Directory:** `apps/admin`. O resto vem do `vercel.json` que está na pasta.
- Não precisa de variáveis de ambiente: o `vercel.json` reencaminha `/v1/*` para `https://kivora-api-ngf1.onrender.com`,
  por isso o cookie de sessão fica no domínio do admin (igual ao que já faz no `web`).
- O `installCommand` usa `--no-frozen-lockfile` porque o `pnpm-lock.yaml` ainda não conhece as dependências do admin.
  Quando abrir um Codespace, corra `pnpm install` na raiz e faça *commit* do `pnpm-lock.yaml`; depois pode voltar a `--frozen-lockfile`.

## 3. Permitir o novo domínio na API (obrigatório)

No Render, serviço da API, edite `CORS_ALLOWED_ORIGINS` e acrescente o endereço do admin (separado por vírgula), por exemplo:

```
https://kivora-black.vercel.app,https://kivora-admin.vercel.app
```

Sem isto, a API recusa os pedidos de escrita (o `originCheckMiddleware` devolve 403 a origens desconhecidas).

## 4. Criar o primeiro administrador

O painel só deixa entrar contas com perfil `ADMIN` ou `SUPPORT` (a API verifica em cada pedido). Registe a conta normalmente no site de clientes
e depois, na base de dados (Render → `kivora-db` → Shell/psql):

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'o-seu-email@exemplo.com';
```

`SUPPORT` vê o painel, os utilizadores e o suporte; tudo o resto é só `ADMIN`.

## 5. O que o painel faz

| Ecrã | O que faz | Estado da API |
|---|---|---|
| Painel | Contadores de pedidos pendentes | pronto |
| Depósitos | Rever, confirmar (credita saldo) ou rejeitar com motivo | pronto; **comprovativo: falta no servidor** |
| Levantamentos | Aprovar → marcar como pago, ou rejeitar | pronto |
| Verificações | Ver frente/verso/selfie, aprovar ou rejeitar com motivo | pronto |
| Utilizadores | Pesquisar, ver ficha e carteira, **banir** (suspende e termina sessões), limitar, reactivar | pronto |
| Planos | Criar/editar tudo (texto, limites, prazo, risco, estado, ordem) | pronto; **imagem: falta no servidor** |
| Subscrições e rendimentos | Aprovar/rejeitar subscrições; aplicar rendimento | aprovar/rejeitar pronto; **rendimento: falta no servidor** |
| Métodos de pagamento | IBAN/instruções, limites, taxa, activar/desactivar | pronto |
| Acordos | Publicar novas versões | pronto |
| Suporte | Responder e fechar tickets | pronto |
| Auditoria | Últimas 200 acções sensíveis | pronto |

Onde o servidor ainda não tem a rota, o ecrã mostra uma mensagem clara em vez de falhar. Ver `BACKEND-PENDENTE.md`.

## 6. Rotas e permissões (referência)

- `GET /v1/admin/summary`, `users`, `users/:id`, `support/*` → ADMIN e SUPPORT.
- Tudo o resto em `/v1/admin/*` → só ADMIN.
- Um administrador não pode confirmar o próprio depósito (a API recusa) nem alterar o próprio estado de conta (o painel esconde o botão).
