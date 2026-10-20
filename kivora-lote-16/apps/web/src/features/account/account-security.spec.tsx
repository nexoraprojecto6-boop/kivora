import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../../app/App";
import { I18nProvider } from "../../i18n/I18nProvider";
import { AuthProvider } from "../auth/AuthContext";

const USER = { id: "u1", email: "maria@example.com", fullName: "Maria Teste", countryOfResidence: "AO", status: "active", emailVerified: false };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiError = (status: number, code: string, fieldErrors?: unknown[]) =>
  json(status, { error: { code, message: "x", requestId: "req-12345678", ...(fieldErrors ? { fieldErrors } : {}) } });

const session = (id: string, current: boolean) => ({
  id,
  current,
  createdAt: "2026-10-01T10:00:00.000Z",
  expiresAt: "2026-10-08T10:00:00.000Z",
});

interface Calls { method: string; url: string; body?: unknown }

function mockApi(opts: {
  sessions?: () => unknown[];
  onRevoke?: (id: string) => Response;
  onRevokeOthers?: () => Response;
  onChangePassword?: (body: unknown) => Response;
  me?: () => Response;
}) {
  const calls: Calls[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url, body });
    if (url.endsWith("/auth/me")) return opts.me ? opts.me() : json(200, { data: { user: USER } });
    if (url.endsWith("/auth/sessions") && method === "GET") return json(200, { data: { sessions: opts.sessions?.() ?? [session("s-current", true)] } });
    if (url.includes("/auth/sessions/revoke-others")) return opts.onRevokeOthers?.() ?? json(200, { data: { revokedSessions: 1 } });
    if (url.includes("/auth/sessions/") && method === "DELETE") return opts.onRevoke?.(decodeURIComponent(url.split("/").pop()!)) ?? json(200, { data: { revoked: true } });
    if (url.endsWith("/auth/change-password")) return opts.onChangePassword?.(body) ?? json(200, { data: { revokedSessions: 0 } });
    return apiError(404, "NOT_FOUND");
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

function renderPage() {
  return render(
    <I18nProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/account/security"]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("segurança da conta: sessões", () => {
  test("lista as sessões, marca a actual e só oferece terminar as outras", async () => {
    mockApi({ sessions: () => [session("s-current", true), session("s-other", false)] });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Segurança da conta" })).toBeInTheDocument();
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Esta sessão")).toBeInTheDocument();
    expect(within(items[0]!).queryByRole("button")).toBeNull();
    expect(within(items[1]!).getByRole("button", { name: /Terminar a sessão iniciada em/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminar todas as outras sessões" })).toBeInTheDocument();
  });

  test("sem outras sessões mostra a mensagem e não oferece terminar todas", async () => {
    mockApi({});
    renderPage();
    expect(await screen.findByText("Não há outras sessões ativas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminar todas as outras sessões" })).toBeNull();
  });

  test("terminar uma sessão chama DELETE com o id certo e actualiza a lista", async () => {
    let list = [session("s-current", true), session("s-other", false)];
    const calls = mockApi({
      sessions: () => list,
      onRevoke: (id) => {
        list = list.filter((s) => s.id !== id);
        return json(200, { data: { revoked: true } });
      },
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Terminar a sessão iniciada em/ }));
    expect(await screen.findByText("Sessão terminada.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/auth/sessions/s-other"))).toBe(true);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
  });

  test("terminar todas as outras chama POST revoke-others", async () => {
    let list = [session("s-current", true), session("a", false), session("b", false)];
    const calls = mockApi({
      sessions: () => list,
      onRevokeOthers: () => {
        list = list.filter((s) => s.current);
        return json(200, { data: { revokedSessions: 2 } });
      },
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Terminar todas as outras sessões" }));
    expect(await screen.findByText("As outras sessões foram terminadas.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/auth/sessions/revoke-others"))).toBe(true);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
  });

  test("falha ao carregar mostra um alerta", async () => {
    const fn = vi.fn(async (input: RequestInfo | URL) => (String(input).endsWith("/auth/me") ? json(200, { data: { user: USER } }) : apiError(500, "INTERNAL_ERROR")));
    vi.stubGlobal("fetch", fn);
    renderPage();
    expect(await screen.findByText("Não foi possível carregar as sessões.")).toBeInTheDocument();
  });

  test("se a sessão terminou (401), volta ao início de sessão", async () => {
    let authed = true;
    const fn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) return authed ? json(200, { data: { user: USER } }) : apiError(401, "UNAUTHENTICATED");
      authed = false;
      return apiError(401, "UNAUTHENTICATED");
    });
    vi.stubGlobal("fetch", fn);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Iniciar sessão" })).toBeInTheDocument();
  });

  test("os textos mudam com o idioma e as datas usam o idioma escolhido", async () => {
    mockApi({ sessions: () => [session("s-current", true), session("s-other", false)] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Segurança da conta" });
    await user.selectOptions(screen.getByLabelText("Selecionar idioma"), "en");
    expect(await screen.findByRole("heading", { name: "Account security" })).toBeInTheDocument();
    expect(screen.getByText("This session")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End all other sessions" })).toBeInTheDocument();
  });
});

describe("segurança da conta: alterar palavra-passe", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, current: string, next: string) {
    await user.type(await screen.findByLabelText("Palavra-passe atual"), current);
    await user.type(screen.getByLabelText("Nova palavra-passe"), next);
  }

  test("validação no cliente: vazio, curta e igual à actual", async () => {
    const calls = mockApi({});
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Alterar palavra-passe" }));
    // campo vazio: a atual é "obrigatória"; a nova tem de ter 12 caracteres (como no registo)
    expect(await screen.findByText("Este campo é obrigatório.")).toBeInTheDocument();
    expect(screen.getByText("A palavra-passe deve ter pelo menos 12 caracteres.", { selector: ".field__error" })).toBeInTheDocument();
    expect(screen.getByLabelText("Palavra-passe atual")).toHaveFocus();

    await fill(user, "palavra-atual-valida", "curta");
    await user.click(screen.getByRole("button", { name: "Alterar palavra-passe" }));
    expect(await screen.findByText(/pelo menos 12 caracteres/, { selector: ".field__error" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nova palavra-passe"));
    await user.type(screen.getByLabelText("Nova palavra-passe"), "palavra-atual-valida");
    await user.click(screen.getByRole("button", { name: "Alterar palavra-passe" }));
    expect(await screen.findByText("A nova palavra-passe tem de ser diferente da atual.")).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/auth/change-password"))).toBe(false);
  });

  test("sucesso: envia as duas palavras-passe, mostra confirmação e limpa os campos", async () => {
    const calls = mockApi({});
    const user = userEvent.setup();
    renderPage();
    await fill(user, "palavra-atual-valida", "nova-palavra-passe-bem-longa");
    await user.click(screen.getByRole("button", { name: "Alterar palavra-passe" }));
    expect(await screen.findByText("Palavra-passe alterada. As outras sessões foram terminadas.")).toBeInTheDocument();
    const call = calls.find((c) => c.url.endsWith("/auth/change-password"))!;
    expect(call.body).toEqual({ currentPassword: "palavra-atual-valida", newPassword: "nova-palavra-passe-bem-longa" });
    expect(screen.getByLabelText("Palavra-passe atual")).toHaveValue("");
    expect(screen.getByLabelText("Nova palavra-passe")).toHaveValue("");
    expect(JSON.stringify({ ...window.localStorage })).not.toMatch(/palavra-atual|nova-palavra/);
  });

  test("palavra-passe actual errada aparece junto do campo", async () => {
    mockApi({ onChangePassword: () => apiError(400, "VALIDATION_ERROR", [{ field: "currentPassword", code: "invalidCredentials" }]) });
    const user = userEvent.setup();
    renderPage();
    await fill(user, "errada-errada-errada", "nova-palavra-passe-bem-longa");
    await user.click(screen.getByRole("button", { name: "Alterar palavra-passe" }));
    expect(await screen.findByText("A palavra-passe atual não está correta.")).toBeInTheDocument();
    expect(screen.getByLabelText("Palavra-passe atual")).toHaveAttribute("aria-invalid", "true");
  });

  test("demasiadas tentativas mostram a mensagem própria", async () => {
    mockApi({ onChangePassword: () => apiError(429, "RATE_LIMITED") });
    const user = userEvent.setup();
    renderPage();
    await fill(user, "palavra-atual-valida", "nova-palavra-passe-bem-longa");
    await user.click(screen.getByRole("button", { name: "Alterar palavra-passe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiadas tentativas");
  });
});

describe("início", () => {
  test("tem ligação para a segurança da conta e a página protege-se sem sessão", async () => {
    mockApi({});
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>,
    );
    await user.click(await screen.findByRole("link", { name: "Segurança da conta" }));
    expect(await screen.findByRole("heading", { name: "Segurança da conta" })).toBeInTheDocument();
  });

  test("sem sessão, /account/security redirecciona para o login", async () => {
    mockApi({ me: () => apiError(401, "UNAUTHENTICATED") });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Iniciar sessão" })).toBeInTheDocument();
  });
});
