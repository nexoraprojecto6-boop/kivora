import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("../services/navigation", () => ({ DASHBOARD_URL: "/app/", LOGIN_URL: "/login", redirectTo: vi.fn() }))

import { AuthProvider } from "../features/auth/AuthContext"
import { I18nProvider } from "../i18n/I18nProvider"
import { redirectTo } from "../services/navigation"
import { AppShell, Gate } from "./App"

const USER = { id: "u1", email: "maria@example.com", fullName: "Maria Teste", countryOfResidence: "AO", status: "active", emailVerified: false }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
const apiError = (status: number, code: string, fieldErrors?: unknown[]) =>
  json(status, { error: { code, message: "x", requestId: "req-12345678", ...(fieldErrors ? { fieldErrors } : {}) } })
const session = (id: string, current: boolean) => ({ id, current, createdAt: "2026-10-01T10:00:00.000Z", expiresAt: "2026-10-08T10:00:00.000Z" })

interface Call { method: string; url: string; body?: unknown }
interface Opts {
  me?: () => Response
  sessions?: () => unknown[]
  sessionsResponse?: () => Response
  onRevoke?: (id: string) => Response
  onRevokeOthers?: () => Response
  onChangePassword?: (body: unknown) => Response
}

function mockApi(opts: Opts = {}) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ method, url, body })
      if (url.endsWith("/auth/me")) return opts.me ? opts.me() : json(200, { data: { user: USER } })
      if (url.endsWith("/auth/logout")) return json(200, { data: { loggedOut: true } })
      if (url.endsWith("/auth/sessions") && method === "GET")
        return opts.sessionsResponse ? opts.sessionsResponse() : json(200, { data: { sessions: opts.sessions?.() ?? [session("s-current", true)] } })
      if (url.includes("/auth/sessions/revoke-others")) return opts.onRevokeOthers?.() ?? json(200, { data: { revokedSessions: 1 } })
      if (url.includes("/auth/sessions/") && method === "DELETE")
        return opts.onRevoke?.(decodeURIComponent(url.split("/").pop()!)) ?? json(200, { data: { revoked: true } })
      if (url.endsWith("/auth/change-password")) return opts.onChangePassword?.(body) ?? json(200, { data: { revokedSessions: 0 } })
      return apiError(404, "NOT_FOUND")
    }),
  )
  return calls
}

function renderDashboard(path = "/") {
  return render(
    <I18nProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Gate>
            <AppShell />
          </Gate>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.mocked(redirectTo).mockClear()
})
afterEach(() => vi.unstubAllGlobals())

describe("acesso ao dashboard", () => {
  test("sem sessão, leva ao login e não mostra o dashboard", async () => {
    mockApi({ me: () => apiError(401, "UNAUTHENTICATED") })
    renderDashboard()
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login"))
    expect(screen.queryByRole("heading", { name: /Olá/ })).toBeNull()
  })

  test("enquanto verifica a sessão mostra o estado de carregamento", async () => {
    let release: (r: Response) => void = () => {}
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))))
    renderDashboard()
    expect(screen.getByRole("status")).toHaveTextContent("A carregar")
    release(json(200, { data: { user: USER } }))
    expect(await screen.findByRole("heading", { name: "Olá, Maria" })).toBeInTheDocument()
    expect(redirectTo).not.toHaveBeenCalled()
  })

  test("endereços desconhecidos voltam ao início", async () => {
    mockApi()
    renderDashboard("/nao-existe")
    expect(await screen.findByRole("heading", { name: "Olá, Maria" })).toBeInTheDocument()
  })
})

describe("início: só dados reais", () => {
  test("mostra o nome, o estado da conta e do email vindos da API", async () => {
    mockApi()
    const { container } = renderDashboard()
    expect(await screen.findByRole("heading", { name: "Olá, Maria" })).toBeInTheDocument()
    const summary = within(container.querySelector(".account-grid") as HTMLElement)
    expect(summary.getByText("Estado da conta")).toBeInTheDocument()
    expect(summary.getByText("Ativa")).toBeInTheDocument()
    expect(summary.getByText("Por verificar")).toBeInTheDocument()
  })

  test("não mostra saldos, rendimentos, transações nem contadores inventados", async () => {
    mockApi()
    const { container } = renderDashboard()
    await screen.findByRole("heading", { name: "Olá, Maria" })
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/AOA|Kz|João|Silva|rendimento|lucro|Investimentos seguros|\d\s?%|\d+[.,]\d{2}/i)
    expect(container.querySelector(".notification-dot")).toBeNull()
    expect(screen.getByText("Os planos ainda não estão disponíveis.")).toBeInTheDocument()
    expect(screen.getByText("Ainda não há atividade para mostrar.")).toBeInTheDocument()
  })

  test("o avatar mostra as iniciais reais e o botão tem nome acessível com o texto visível", async () => {
    mockApi()
    renderDashboard()
    const avatar = await screen.findByRole("button", { name: /Abrir perfil/ })
    expect(avatar).toHaveTextContent("MT")
    expect(avatar.getAttribute("aria-label")).toContain("MT")
  })

  test("os atalhos e botões do início navegam para áreas que existem", async () => {
    mockApi()
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByRole("heading", { name: "Olá, Maria" })
    await user.click(screen.getByRole("button", { name: "Segurança" }))
    expect(await screen.findByRole("heading", { name: "Segurança", level: 1 })).toBeInTheDocument()
  })

  test("o botão principal e 'Ver todos' funcionam", async () => {
    mockApi()
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByRole("heading", { name: "Olá, Maria" })
    await user.click(screen.getByRole("button", { name: /Segurança da conta/ }))
    expect(await screen.findByRole("heading", { name: "Segurança", level: 1 })).toBeInTheDocument()
  })
})

describe("áreas que o servidor ainda não suporta", () => {
  test.each([
    ["/wallet", "Carteira"],
    ["/plans", "Planos"],
    ["/deposit", "Depósitos"],
    ["/withdraw", "Levantamentos"],
    ["/history", "Histórico de Transações"],
    ["/agreements", "Acordos e Contratos"],
    ["/verification", "Verificação de identidade"],
    ["/notifications", "Notificações"],
    ["/support", "Suporte e Ajuda"],
  ])("%s explica que não está disponível e não mostra dados", async (path, title) => {
    mockApi()
    renderDashboard(path)
    expect(await screen.findByRole("heading", { name: title, level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/ainda não está disponível/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/AOA|Kz|\d+[.,]\d{2}|\d\s?%/)
  })

  test("um plano antigo redirecciona para a lista de planos", async () => {
    mockApi()
    renderDashboard("/plans/gold")
    expect(await screen.findByRole("heading", { name: "Planos", level: 1 })).toBeInTheDocument()
  })

  test("o botão 'Voltar ao início' e o botão de voltar funcionam", async () => {
    mockApi()
    const user = userEvent.setup()
    renderDashboard("/wallet")
    await user.click(await screen.findByRole("button", { name: "Voltar ao início" }))
    expect(await screen.findByRole("heading", { name: "Olá, Maria" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Notificações" }))
    await screen.findByRole("heading", { name: "Notificações", level: 1 })
    await user.click(screen.getByRole("button", { name: "Voltar" }))
    expect(await screen.findByRole("heading", { name: "Olá, Maria" })).toBeInTheDocument()
  })

  test("a barra de baixo tem as 5 ligações com a página activa assinalada", async () => {
    mockApi()
    renderDashboard("/wallet")
    await screen.findByRole("heading", { name: "Carteira", level: 1 })
    const nav = screen.getAllByRole("navigation", { name: "Navegação principal" }).find((n) => n.classList.contains("bottom-nav"))!
    const links = within(nav).getAllByRole("link")
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/wallet", "/plans", "/notifications", "/profile"])
    expect(within(nav).getByRole("link", { name: "Carteira" })).toHaveClass("active")
  })
})

describe("gaveta do perfil", () => {
  test("fechada, está fora da ordem de tabulação; abre com o avatar e mostra o nome real", async () => {
    mockApi()
    const user = userEvent.setup()
    const { container } = renderDashboard()
    await screen.findByRole("heading", { name: "Olá, Maria" })
    const layer = container.querySelector(".drawer-wrap")!
    expect(layer).toHaveAttribute("inert")
    expect(layer).toHaveAttribute("aria-hidden", "true")
    await user.click(screen.getByRole("button", { name: /Abrir perfil/ }))
    expect(layer).not.toHaveAttribute("inert")
    expect(layer).toHaveClass("is-open")
    expect(within(layer as HTMLElement).getByText("Maria Teste")).toBeInTheDocument()
  })

  test("os itens do menu navegam e fecham a gaveta", async () => {
    mockApi()
    const user = userEvent.setup()
    const { container } = renderDashboard()
    await screen.findByRole("heading", { name: "Olá, Maria" })
    await user.click(screen.getByRole("button", { name: /Abrir perfil/ }))
    const menu = container.querySelector(".drawer-nav") as HTMLElement
    await user.click(within(menu).getByRole("button", { name: "Definições" }))
    expect(await screen.findByRole("heading", { name: "Definições", level: 1 })).toBeInTheDocument()
    expect(container.querySelector(".drawer-wrap")).not.toHaveClass("is-open")
  })

  test("terminar sessão chama a API e leva ao login", async () => {
    const calls = mockApi()
    const user = userEvent.setup()
    const { container } = renderDashboard()
    await screen.findByRole("heading", { name: "Olá, Maria" })
    await user.click(screen.getByRole("button", { name: /Abrir perfil/ }))
    await user.click(within(container.querySelector(".drawer") as HTMLElement).getByRole("button", { name: "Terminar sessão" }))
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login"))
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/auth/logout"))).toBe(true)
  })
})

describe("perfil", () => {
  test("mostra o nome, o estado e as ligações; cada linha abre o seu ecrã", async () => {
    mockApi()
    const user = userEvent.setup()
    renderDashboard("/profile")
    expect(await screen.findByRole("heading", { name: "Maria Teste", level: 1 })).toBeInTheDocument()
    const list = document.querySelector(".settings-list") as HTMLElement
    expect(within(list).getAllByRole("button")).toHaveLength(8)
    await user.click(within(list).getByRole("button", { name: /Dados pessoais/ }))
    expect(await screen.findByText("maria@example.com")).toBeInTheDocument()
    expect(screen.getByText("Angola")).toBeInTheDocument()
    expect(screen.getByText("A edição dos dados pessoais ainda não está disponível.")).toBeInTheDocument()
  })

  test("contactos mostra o email e explica que o telefone ainda não é recolhido", async () => {
    mockApi()
    renderDashboard("/profile/contacts")
    expect(await screen.findByText("maria@example.com")).toBeInTheDocument()
    expect(screen.getByText("O telefone ainda não é recolhido.")).toBeInTheDocument()
  })
})

describe("definições", () => {
  test("mudar de idioma actualiza o dashboard e fica guardado", async () => {
    mockApi()
    const user = userEvent.setup()
    renderDashboard("/settings")
    await user.click(await screen.findByRole("button", { name: /Idioma/ }))
    await user.click(screen.getByRole("button", { name: "English" }))
    expect(await screen.findByRole("heading", { name: "Preferences" })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe("en")
    expect(window.localStorage.getItem("kivora.language")).toBe("en")
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument()
  })

  test("o tema escuro aplica-se e persiste", async () => {
    mockApi()
    const user = userEvent.setup()
    renderDashboard("/settings")
    await user.click(await screen.findByRole("button", { name: "Escuro" }))
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(window.localStorage.getItem("kivora.theme")).toBe("dark")
    expect(screen.getByRole("button", { name: "Escuro" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "Claro" }))
    expect(document.documentElement.dataset.theme).toBe("light")
  })

  test("o tema guardado aplica-se ao abrir o dashboard", async () => {
    window.localStorage.setItem("kivora.theme", "dark")
    mockApi()
    renderDashboard()
    await screen.findByRole("heading", { name: "Olá, Maria" })
    expect(document.documentElement.dataset.theme).toBe("dark")
  })

  test("o interruptor de notificações está desactivado porque o servidor não as suporta", async () => {
    mockApi()
    renderDashboard("/settings")
    expect(await screen.findByRole("button", { name: /Notificações \(indisponível\)/ })).toBeDisabled()
  })

  test("as ligações de segurança abrem as páginas certas", async () => {
    mockApi()
    const user = userEvent.setup()
    renderDashboard("/settings")
    await user.click(await screen.findByRole("button", { name: "Alterar palavra-passe" }))
    expect(await screen.findByLabelText("Palavra-passe atual")).toBeInTheDocument()
  })
})

describe("sessões", () => {
  test("lista as sessões, identifica a actual e só oferece terminar as outras", async () => {
    mockApi({ sessions: () => [session("s-current", true), session("s-other", false)] })
    renderDashboard("/security/sessions")
    const items = await screen.findAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(within(items[0]!).getByText("Esta sessão")).toBeInTheDocument()
    expect(within(items[0]!).queryByRole("button")).toBeNull()
    expect(within(items[1]!).getByRole("button", { name: /Terminar a sessão iniciada em/ })).toBeInTheDocument()
  })

  test("terminar uma sessão chama DELETE com o id certo e actualiza a lista", async () => {
    let list = [session("s-current", true), session("s-other", false)]
    const calls = mockApi({
      sessions: () => list,
      onRevoke: (id) => {
        list = list.filter((s) => s.id !== id)
        return json(200, { data: { revoked: true } })
      },
    })
    const user = userEvent.setup()
    renderDashboard("/security/sessions")
    await user.click(await screen.findByRole("button", { name: /Terminar a sessão iniciada em/ }))
    expect(await screen.findByText("Sessão terminada.")).toBeInTheDocument()
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/auth/sessions/s-other"))).toBe(true)
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))
  })

  test("terminar todas as outras chama POST revoke-others", async () => {
    let list = [session("s-current", true), session("a", false), session("b", false)]
    const calls = mockApi({
      sessions: () => list,
      onRevokeOthers: () => {
        list = list.filter((s) => s.current)
        return json(200, { data: { revokedSessions: 2 } })
      },
    })
    const user = userEvent.setup()
    renderDashboard("/security/sessions")
    await user.click(await screen.findByRole("button", { name: "Terminar todas as outras sessões" }))
    expect(await screen.findByText("As outras sessões foram terminadas.")).toBeInTheDocument()
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/auth/sessions/revoke-others"))).toBe(true)
  })

  test("sem outras sessões não oferece terminar todas", async () => {
    mockApi()
    renderDashboard("/security/sessions")
    expect(await screen.findByText("Não há outras sessões ativas.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Terminar todas as outras sessões" })).toBeNull()
  })

  test("falha ao carregar mostra um alerta", async () => {
    mockApi({ sessionsResponse: () => apiError(500, "INTERNAL_ERROR") })
    renderDashboard("/security/sessions")
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as sessões.")
  })

  test("se a sessão terminou (401), volta ao login", async () => {
    let authed = true
    mockApi({
      me: () => (authed ? json(200, { data: { user: USER } }) : apiError(401, "UNAUTHENTICATED")),
      sessionsResponse: () => {
        authed = false
        return apiError(401, "UNAUTHENTICATED")
      },
    })
    renderDashboard("/security/sessions")
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login"))
  })
})

describe("alterar palavra-passe", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, current: string, next: string) {
    await user.type(await screen.findByLabelText("Palavra-passe atual"), current)
    await user.type(screen.getByLabelText("Nova palavra-passe"), next)
  }
  const submit = () => screen.getByRole("button", { name: "Alterar palavra-passe" })

  test("validação no cliente: vazio, curta e igual à actual, sem chamar a API", async () => {
    const calls = mockApi()
    const user = userEvent.setup()
    renderDashboard("/security/password")
    await user.click(await screen.findByRole("button", { name: "Alterar palavra-passe" }))
    expect(await screen.findByText("Este campo é obrigatório.")).toBeInTheDocument()
    expect(screen.getByLabelText("Palavra-passe atual")).toHaveFocus()
    expect(screen.getByLabelText("Palavra-passe atual")).toHaveAttribute("aria-invalid", "true")

    await fill(user, "palavra-atual-valida", "curta")
    await user.click(submit())
    expect(await screen.findByText("A palavra-passe deve ter pelo menos 12 caracteres.")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("Nova palavra-passe"))
    await user.type(screen.getByLabelText("Nova palavra-passe"), "palavra-atual-valida")
    await user.click(submit())
    expect(await screen.findByText("A nova palavra-passe tem de ser diferente da atual.")).toBeInTheDocument()
    expect(calls.some((c) => c.url.endsWith("/auth/change-password"))).toBe(false)
  })

  test("sucesso: envia as duas palavras-passe, confirma e limpa os campos", async () => {
    const calls = mockApi()
    const user = userEvent.setup()
    renderDashboard("/security/password")
    await fill(user, "palavra-atual-valida", "nova-palavra-passe-bem-longa")
    await user.click(submit())
    expect(await screen.findByText("Palavra-passe alterada. As outras sessões foram terminadas.")).toBeInTheDocument()
    const call = calls.find((c) => c.url.endsWith("/auth/change-password"))!
    expect(call.body).toEqual({ currentPassword: "palavra-atual-valida", newPassword: "nova-palavra-passe-bem-longa" })
    expect(screen.getByLabelText("Palavra-passe atual")).toHaveValue("")
    expect(JSON.stringify({ ...window.localStorage })).not.toMatch(/palavra-atual|nova-palavra/)
  })

  test("palavra-passe actual errada aparece junto do campo", async () => {
    mockApi({ onChangePassword: () => apiError(400, "VALIDATION_ERROR", [{ field: "currentPassword", code: "invalidCredentials" }]) })
    const user = userEvent.setup()
    renderDashboard("/security/password")
    await fill(user, "errada-errada-errada", "nova-palavra-passe-bem-longa")
    await user.click(submit())
    expect(await screen.findByText("A palavra-passe atual não está correta.")).toBeInTheDocument()
    expect(screen.getByLabelText("Palavra-passe atual")).toHaveAttribute("aria-invalid", "true")
  })

  test("demasiadas tentativas e falha de rede têm mensagens próprias", async () => {
    let mode: "rate" | "net" = "rate"
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith("/auth/me")) return json(200, { data: { user: USER } })
        if (mode === "net") throw new TypeError("Failed to fetch")
        return apiError(429, "RATE_LIMITED")
      }),
    )
    const user = userEvent.setup()
    renderDashboard("/security/password")
    await fill(user, "palavra-atual-valida", "nova-palavra-passe-bem-longa")
    await user.click(submit())
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiadas tentativas")
    mode = "net"
    await user.click(submit())
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível contactar o serviço"))
  })
})
