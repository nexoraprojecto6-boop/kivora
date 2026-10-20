import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../../app/App";
import { I18nProvider } from "../../i18n/I18nProvider";
import { AuthProvider } from "./AuthContext";

const USER = { id: "u1", email: "maria@example.com", fullName: "Maria Teste", countryOfResidence: "AO", status: "active", emailVerified: false };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiError = (status: number, code: string, fieldErrors?: unknown[]) =>
  json(status, { error: { code, message: "x", requestId: "req-12345678", ...(fieldErrors ? { fieldErrors } : {}) } });

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function mockApi(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderApp(path: string) {
  return render(
    <I18nProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  );
}

const anonymous: Handler = (url) => (url.endsWith("/auth/me") ? apiError(401, "UNAUTHENTICATED") : apiError(404, "NOT_FOUND"));

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("página de login", () => {
  test("mostra o selector de idioma e muda os textos ao trocar de idioma", async () => {
    mockApi(anonymous);
    const user = userEvent.setup();
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: "Iniciar sessão" })).toBeInTheDocument();
    const select = screen.getByLabelText("Selecionar idioma");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Português", "English", "Français", "Español"]);
    await user.selectOptions(select, "en");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem("kivora.language")).toBe("en");
  });

  test("submeter vazio mostra erros traduzidos e não chama a API de login", async () => {
    const fn = mockApi(anonymous);
    const user = userEvent.setup();
    renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Entrar" }));
    expect((await screen.findAllByText(/Este campo é obrigatório/)).length).toBe(2);
    expect(screen.getByText("Corrija os campos assinalados.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(fn.mock.calls.some(([u]) => String(u).endsWith("/auth/login"))).toBe(false);
  });

  test("login com sucesso envia credenciais e vai para o início", async () => {
    const fn = mockApi((url) => {
      if (url.endsWith("/auth/me")) return apiError(401, "UNAUTHENTICATED");
      if (url.endsWith("/auth/login")) return json(200, { data: { user: USER } });
      return apiError(404, "NOT_FOUND");
    });
    const user = userEvent.setup();
    renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "Maria@Example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "uma-palavra-passe-longa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("heading", { name: "Olá, Maria Teste" })).toBeInTheDocument();
    const loginCall = fn.mock.calls.find(([u]) => String(u).endsWith("/auth/login"))!;
    expect(JSON.parse((loginCall[1] as RequestInit).body as string)).toEqual({
      email: "maria@example.com",
      password: "uma-palavra-passe-longa",
    });
  });

  test("credenciais erradas mostram uma mensagem genérica num alerta", async () => {
    mockApi((url) => (url.endsWith("/auth/login") ? apiError(401, "UNAUTHENTICATED") : anonymous(url)));
    const user = userEvent.setup();
    renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "maria@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "errada-errada-errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Os dados de acesso não estão corretos.");
  });

  test("demasiadas tentativas e falha de rede têm mensagens próprias", async () => {
    let code: "rate" | "net" = "rate";
    mockApi((url) => {
      if (url.endsWith("/auth/login")) {
        if (code === "net") throw new TypeError("Failed to fetch");
        return apiError(429, "RATE_LIMITED");
      }
      return anonymous(url);
    });
    const user = userEvent.setup();
    renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "maria@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "qualquer-coisa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiadas tentativas");
    code = "net";
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível contactar o serviço"));
  });

  test("o botão de mostrar palavra-passe alterna o tipo do campo", async () => {
    mockApi(anonymous);
    const user = userEvent.setup();
    renderApp("/login");
    const field = await screen.findByLabelText("Palavra-passe");
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar palavra-passe" }));
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Esconder palavra-passe" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("página de registo", () => {
  async function fillValid(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText("Nome completo"), "Maria Teste");
    await user.type(screen.getByLabelText("Email"), "maria@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "uma-palavra-passe-longa");
    await user.type(screen.getByLabelText("País de residência"), "ao");
    await user.click(screen.getByLabelText("Li e aceito os Termos e Condições"));
    await user.click(screen.getByLabelText("Li e aceito a Política de Privacidade"));
  }

  test("validação no cliente: palavra-passe curta e termos por aceitar", async () => {
    const fn = mockApi(anonymous);
    const user = userEvent.setup();
    renderApp("/register");
    await user.type(await screen.findByLabelText("Nome completo"), "Maria Teste");
    await user.type(screen.getByLabelText("Email"), "maria@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "curta");
    await user.type(screen.getByLabelText("País de residência"), "AO");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText(/pelo menos 12 caracteres/, { selector: ".field__error" })).toBeInTheDocument();
    expect(screen.getAllByText(/É necessário aceitar para continuar/).length).toBe(2);
    expect(fn.mock.calls.some(([u]) => String(u).endsWith("/auth/register"))).toBe(false);
  });

  test("registo com sucesso mostra confirmação sem iniciar sessão", async () => {
    const fn = mockApi((url) => (url.endsWith("/auth/register") ? json(201, { data: { user: USER } }) : anonymous(url)));
    const user = userEvent.setup();
    renderApp("/register");
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("heading", { name: "Conta criada" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ainda não está verificado");
    expect(screen.getByRole("link", { name: "Ir para o início de sessão" })).toHaveAttribute("href", "/login");
    const call = fn.mock.calls.find(([u]) => String(u).endsWith("/auth/register"))!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toMatchObject({ email: "maria@example.com", countryOfResidence: "AO", acceptTerms: true, acceptPrivacy: true });
  });

  test("email já usado e registo desactivado têm mensagens próprias", async () => {
    let code = "CONFLICT";
    mockApi((url) => (url.endsWith("/auth/register") ? apiError(code === "CONFLICT" ? 409 : 403, code) : anonymous(url)));
    const user = userEvent.setup();
    renderApp("/register");
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível criar a conta com este email.");
    code = "FEATURE_DISABLED";
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("O registo não está disponível neste momento."));
  });

  test("erros por campo vindos da API aparecem junto do campo", async () => {
    mockApi((url) =>
      url.endsWith("/auth/register") ? apiError(400, "VALIDATION_ERROR", [{ field: "email", code: "invalidEmail" }]) : anonymous(url),
    );
    const user = userEvent.setup();
    renderApp("/register");
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Indique um email válido.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("rotas protegidas e início", () => {
  test("sem sessão, /dashboard redirecciona para o login", async () => {
    mockApi(anonymous);
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Iniciar sessão" })).toBeInTheDocument();
  });

  test("com sessão válida mostra só dados reais e permite terminar sessão", async () => {
    let loggedOut = false;
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return loggedOut ? apiError(401, "UNAUTHENTICATED") : json(200, { data: { user: USER } });
      if (url.endsWith("/auth/logout")) {
        loggedOut = true;
        return json(200, { data: { loggedOut: true } });
      }
      return apiError(404, "NOT_FOUND");
    });
    const user = userEvent.setup();
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Olá, Maria Teste" })).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
    expect(screen.getByText("Por verificar")).toBeInTheDocument();
    expect(screen.getByText("Ainda não há nada para mostrar.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Kz|AOA|\d+[.,]\d{2}/); // nenhum saldo inventado
    await user.click(screen.getByRole("button", { name: "Terminar sessão" }));
    expect(await screen.findByRole("heading", { name: "Iniciar sessão" })).toBeInTheDocument();
  });

  test("nenhum token fica em localStorage ou sessionStorage", async () => {
    mockApi((url) => (url.endsWith("/auth/login") ? json(200, { data: { user: USER } }) : anonymous(url)));
    const user = userEvent.setup();
    renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "maria@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "uma-palavra-passe-longa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("heading", { name: "Olá, Maria Teste" });
    const stored = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage });
    expect(stored).not.toMatch(/token|session|password|uma-palavra/i);
  });
});
