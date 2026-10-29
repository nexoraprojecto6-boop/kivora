import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Fingerprint,
  Globe2,
  History,
  Home,
  Languages,
  LockKeyhole,
  LogOut,
  Moon,
  PieChart,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  UserRound,
  WalletCards,
  X,
} from "lucide-react"
import type { SessionSummary } from "@kivora/shared"
import { changePasswordSchema } from "@kivora/validation"
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../features/auth/AuthContext.js"
import { toErrorMap, zodToErrorMap, type FieldErrorMap } from "../features/auth/form-errors.js"
import { useI18n } from "../i18n/I18nProvider.js"
import { SUPPORTED_LANGUAGES, isLanguageCode } from "../i18n/resources.js"
import { ApiError, authApi } from "../services/api-client.js"
import { LOGIN_URL, redirectTo } from "../services/navigation.js"
import { Logo } from "../brand/index.js"
import {
  AgreementsPage, DepositPage, HistoryPage, HomeLive, NotificationsPage, PlanDetailPage, PlansPage,
  SupportPage, VerificationPage, WalletPage, WithdrawPage,
} from "./screens.js"

/*
 * Dashboard KIVORA (desenho original mantido: componentes, estrutura e classes CSS).
 * A lógica foi ligada à API real. O que o servidor ainda não suporta (carteira, depósitos,
 * levantamentos, histórico, planos, acordos, verificação, notificações, suporte) mostra
 * uma página de "indisponível": não há saldos, rendimentos nem transações inventados.
 * Ver docs/api/endpoints.md.
 */

/**
 * Em ecrãs grandes o CSS original deixa a largura da coluna central depender do conteúdo; no desenho
 * eram as três cartas de planos lado a lado (cerca de 594 px). Sem esses dados inventados a coluna
 * encolheria para metade, por isso fixa-se aqui a largura equivalente (o ficheiro CSS não é alterado).
 */
const COLUMN_WIDTH = { width: "100%", maxWidth: "600px" } as const

const THEME_KEY = "kivora.theme"

type Theme = "light" | "dark"

function readTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // preferência não sensível: se não for possível guardar, aplica-se só nesta visita
  }
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase()
}

function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(code) ?? code
  } catch {
    return code
  }
}

function useStatusLabels() {
  const { t } = useI18n()
  const { user } = useAuth()
  return {
    account: user ? t(`dashboard.status.${user.status}`) : "",
    email: user ? (user.emailVerified ? t("dashboard.emailVerified") : t("dashboard.emailNotVerified")) : "",
  }
}

type IconType = typeof Home

function IconButton({
  label,
  children,
  onClick,
  className = "",
}: {
  label: string
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

/** Estado da gaveta do perfil, partilhado entre o cabeçalho (avatar) e a barra de baixo (Perfil). */
const ProfileDrawerContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
})

function useProfileDrawer() {
  return useContext(ProfileDrawerContext)
}

export function Header({ title, back = false }: { title?: string; back?: boolean }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { user } = useAuth()
  const { setOpen } = useProfileDrawer()
  const initials = user ? initialsOf(user.fullName) : ""

  // Sem página anterior (por exemplo, acesso directo por endereço) volta ao início.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate("/")
  }

  return (
    <>
      <header className="topbar">
        {back ? (
          <div className="topbar-title">
            <IconButton label={t("dash.aria.back")} onClick={goBack}>
              <ArrowLeft size={20} />
            </IconButton>
            <strong role="heading" aria-level={1}>
              {title}
            </strong>
          </div>
        ) : (
          <Logo height={32} />
        )}
        <div className="header-actions">
          <IconButton label={t("dash.aria.notifications")} onClick={() => navigate("/notifications")}>
            <Bell size={20} />
          </IconButton>
          <button className="avatar" aria-label={`${initials} – ${t("dash.aria.openProfile")}`} onClick={() => setOpen(true)}>
            {initials}
          </button>
        </div>
      </header>
    </>
  )
}

const menuItems = [
  ["home", Home, "/"],
  ["wallet", WalletCards, "/wallet"],
  ["plans", PieChart, "/plans"],
  ["deposits", ArrowDownToLine, "/deposit"],
  ["withdrawals", ArrowUpFromLine, "/withdraw"],
  ["history", History, "/history"],
  ["agreements", FileText, "/agreements"],
  ["verification", Fingerprint, "/verification"],
  ["notifications", Bell, "/notifications"],
  ["support", CircleHelp, "/support"],
  ["settings", Settings, "/settings"],
  ["profile", UserRound, "/profile"],
] as const

function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const status = useStatusLabels()

  return (
    <div className={`drawer-wrap ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open}>
      <button className="drawer-scrim" aria-label={t("dash.aria.closeMenu")} onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <Logo height={30} />
          <IconButton label={t("dash.aria.closeMenu")} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="user-row">
          <span className="avatar large">{user ? initialsOf(user.fullName) : ""}</span>
          <div>
            <strong>{user?.fullName}</strong>
            <small>
              {status.account} {user?.emailVerified ? <span className="verified">●</span> : null}
            </small>
          </div>
        </div>
        <nav className="drawer-nav" aria-label={t("dash.nav.menu")}>
          {menuItems.map(([key, Icon, href]) => (
            <button
              key={key}
              onClick={() => {
                navigate(href)
                onClose()
              }}
            >
              <Icon size={17} />
              <span>{t(`dash.nav.${key}`)}</span>
              <ChevronRight size={16} />
            </button>
          ))}
        </nav>
        <button className="logout-link" onClick={() => void logout()}>
          <LogOut size={17} /> {t("common.actions.logout")}
        </button>
      </aside>
    </div>
  )
}

function BottomNav() {
  const { t } = useI18n()
  const { open, setOpen } = useProfileDrawer()
  // Ordem: Início, Notificações, Planos (ao centro), Perfil (abre o menu) e Carteira.
  const items = [
    ["home", Home, "/"],
    ["notifications", Bell, "/notifications"],
    ["plans", PieChart, "/plans"],
    ["profile", null, null],
    ["wallet", WalletCards, "/wallet"],
  ] as const
  return (
    <nav className="bottom-nav" aria-label={t("dash.aria.mainNav")}>
      {items.map(([key, Icon, href]) =>
        href === null || Icon === null ? (
          <button key={key} type="button" className={open ? "active" : ""} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
            <UserRound size={19} />
            <span>{t(`dash.nav.${key}`)}</span>
          </button>
        ) : (
          <NavLink key={key} to={href} end={href === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon size={19} />
            <span>{t(`dash.nav.${key}`)}</span>
          </NavLink>
        ),
      )}
    </nav>
  )
}

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`page ${className}`}>{children}</main>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  )
}

export function ActionTile({ icon: Icon, label, onClick }: { icon: IconType; label: string; onClick?: () => void }) {
  return (
    <button className="action-tile" onClick={onClick}>
      <span>
        <Icon size={20} />
      </span>
      <small>{label}</small>
    </button>
  )
}

/* ------------------------------------------------------------------ Início */

/**
 * Início: só o cartão da carteira (saldo), atalhos, convite de amigos e planos.
 * O resumo da conta e a atividade recente passaram para a página Carteira (histórico de transações).
 */
function HomePage() {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <Page>
      <Header />
      <HomeLive />
      <div className="quick-actions">
        <ActionTile icon={LockKeyhole} label={t("dash.actions.security")} onClick={() => navigate("/security")} />
        <ActionTile icon={UserRound} label={t("dash.actions.profile")} onClick={() => navigate("/profile")} />
        <ActionTile icon={Clock3} label={t("dash.actions.sessions")} onClick={() => navigate("/security/sessions")} />
        <ActionTile icon={Settings} label={t("dash.actions.settings")} onClick={() => navigate("/settings")} />
      </div>
    </Page>
  )
}

/* ------------------------------------- Áreas que o servidor ainda não suporta */

/* ------------------------------------------------------------------- Perfil */

function ProfilePage() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { user, logout } = useAuth()
  const status = useStatusLabels()
  if (!user) return null
  const languageName = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name ?? language

  const profileItems = [
    ["personal", UserRound, "/profile/data"],
    ["contacts", Smartphone, "/profile/contacts"],
    ["country", Globe2, "/profile/data"],
    ["language", Languages, "/settings"],
    ["notifications", Bell, "/notifications"],
    ["password", LockKeyhole, "/security/password"],
    ["security", ShieldCheck, "/security"],
    ["sessions", Clock3, "/security/sessions"],
  ] as const

  return (
    <Page>
      <Header title={t("dash.nav.profile")} back />
      <div className="profile-hero">
        <span className="avatar xlarge">{initialsOf(user.fullName)}</span>
        <div>
          <h1>{user.fullName}</h1>
          <p>
            {status.account} {user.emailVerified ? <span className="verified">●</span> : null}
          </p>
        </div>
      </div>
      <div className="settings-list">
        {profileItems.map(([key, Icon, href]) => (
          <button key={key} onClick={() => navigate(href)}>
            <Icon size={18} />
            <span>{t(`dash.profile.${key}`)}</span>
            {key === "language" && <small>{languageName}</small>}
            {key === "country" && <small>{countryName(user.countryOfResidence, language)}</small>}
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
      <button className="danger-button" onClick={() => void logout()}>
        <LogOut size={17} /> {t("common.actions.logout")}
      </button>
    </Page>
  )
}

function PersonalDataPage() {
  const { t, language } = useI18n()
  const { user } = useAuth()
  const status = useStatusLabels()
  if (!user) return null
  return (
    <Page className="form-page">
      <Header title={t("dash.profile.personal")} back />
      <div className="form-surface">
        <h2>{t("dash.profile.personal")}</h2>
        <div className="detail-grid">
          <div>
            <span>{t("dash.profile.fullName")}</span>
            <strong>{user.fullName}</strong>
          </div>
          <div>
            <span>{t("dash.profile.email")}</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>{t("dash.profile.country")}</span>
            <strong>{countryName(user.countryOfResidence, language)}</strong>
          </div>
          <div>
            <span>{t("dash.profile.accountStatus")}</span>
            <strong>{status.account}</strong>
          </div>
        </div>
        <div className="info-box">
          <CircleHelp size={18} />
          <p>{t("dash.profile.editUnavailable")}</p>
        </div>
      </div>
    </Page>
  )
}

function ContactsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const status = useStatusLabels()
  if (!user) return null
  return (
    <Page className="form-page">
      <Header title={t("dash.profile.contacts")} back />
      <div className="form-surface">
        <h2>{t("dash.profile.contacts")}</h2>
        <div className="detail-grid">
          <div>
            <span>{t("dash.profile.email")}</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>{t("dash.home.statEmail")}</span>
            <strong>{status.email}</strong>
          </div>
        </div>
        <div className="info-box">
          <CircleHelp size={18} />
          <p>{t("dash.profile.noPhone")}</p>
        </div>
      </div>
    </Page>
  )
}

/* ------------------------------------------------------------- Definições */

function SettingsPage() {
  const navigate = useNavigate()
  const { t, language, setLanguage } = useI18n()
  const { logout } = useAuth()
  const [langOpen, setLangOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const dark = theme === "dark"
  const languageName = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name ?? language

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <Page className="form-page">
      <Header title={t("dash.nav.settings")} back />
      <div className="form-surface">
        <h2>{t("dash.settings.preferences")}</h2>
        <button className="setting-row" aria-expanded={langOpen} onClick={() => setLangOpen((v) => !v)}>
          <Languages size={18} />
          <span>{t("dash.settings.language")}</span>
          <small>{languageName}</small>
          <ChevronDown size={16} />
        </button>
        {langOpen && (
          <div className="method-list">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                className={l.code === language ? "selected" : ""}
                lang={l.code}
                onClick={() => {
                  if (isLanguageCode(l.code)) setLanguage(l.code)
                  setLangOpen(false)
                }}
              >
                <span className="method-icon">
                  <Languages size={19} />
                </span>
                <span>
                  <strong>{l.name}</strong>
                </span>
                {l.code === language ? <Check size={18} /> : <ChevronRight size={18} />}
              </button>
            ))}
          </div>
        )}
        <div className="setting-row">
          <Bell size={18} />
          <span>{t("dash.settings.notifications")}</span>
          <small>{t("dash.settings.unavailableTag")}</small>
          <button className="switch" aria-label={t("dash.settings.notificationsSwitch")} disabled aria-disabled="true">
            <i />
          </button>
        </div>
        <h2>{t("dash.settings.theme")}</h2>
        <div className="theme-choice">
          <button className={!dark ? "active" : ""} aria-pressed={!dark} onClick={() => setTheme("light")}>
            <Sun size={18} /> {t("dash.settings.light")}
          </button>
          <button className={dark ? "active" : ""} aria-pressed={dark} onClick={() => setTheme("dark")}>
            <Moon size={18} /> {t("dash.settings.dark")}
          </button>
        </div>
        <h2>{t("dash.settings.security")}</h2>
        <button className="setting-row" onClick={() => navigate("/security/password")}>
          <LockKeyhole size={18} />
          <span>{t("dash.settings.password")}</span>
          <ChevronRight size={17} />
        </button>
        <button className="setting-row" onClick={() => navigate("/security/sessions")}>
          <Clock3 size={18} />
          <span>{t("dash.settings.sessions")}</span>
          <ChevronRight size={17} />
        </button>
        <button className="danger-button" onClick={() => void logout()}>
          <LogOut size={17} /> {t("common.actions.logout")}
        </button>
      </div>
    </Page>
  )
}

/* -------------------------------------------------------------- Segurança */

function SecurityHubPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  return (
    <Page>
      <Header title={t("dash.profile.security")} back />
      <div className="settings-list">
        <button onClick={() => navigate("/security/password")}>
          <LockKeyhole size={18} />
          <span>{t("dash.profile.password")}</span>
          <ChevronRight size={17} />
        </button>
        <button onClick={() => navigate("/security/sessions")}>
          <Clock3 size={18} />
          <span>{t("dash.profile.sessions")}</span>
          <ChevronRight size={17} />
        </button>
      </div>
    </Page>
  )
}

/** Um 401 numa chamada significa que a sessão terminou: o contexto volta a perguntar ao servidor e o acesso redirecciona para o login. */
function useSessionExpiry() {
  const { refresh } = useAuth()
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "UNAUTHENTICATED") void refresh()
    },
    [refresh],
  )
}

function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "auth.errors.generic"
  if (error.code === "NETWORK") return "auth.errors.network"
  if (error.code === "RATE_LIMITED") return "auth.errors.tooManyAttempts"
  return "auth.errors.generic"
}

function PasswordPage() {
  const { t } = useI18n()
  const onExpired = useSessionExpiry()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [errors, setErrors] = useState<FieldErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const first = (["currentPassword", "newPassword"] as const).find((f) => f in errors)
    if (first) document.getElementById(`pwd-${first}`)?.focus()
  }, [errors])

  const fieldError = (field: string) => {
    const code = errors[field]
    if (!code) return undefined
    if (code === "invalidCredentials") return t("account.errors.wrongCurrent")
    if (code === "sameAsCurrent") return t("account.errors.sameAsCurrent")
    return t(`auth.errors.${code}`)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setDone(false)
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword })
    if (!parsed.success) {
      setErrors(zodToErrorMap(parsed.error))
      return
    }
    setErrors({})
    setBusy(true)
    try {
      await authApi.changePassword(parsed.data)
      setCurrentPassword("")
      setNewPassword("")
      setDone(true)
    } catch (error) {
      onExpired(error)
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.fieldErrors.length > 0) {
        setErrors(toErrorMap(error.fieldErrors))
      } else {
        setFormError(t(errorKey(error)))
      }
    } finally {
      setBusy(false)
    }
  }

  const currentError = fieldError("currentPassword")
  const newError = fieldError("newPassword")

  return (
    <Page className="form-page">
      <Header title={t("dash.profile.password")} back />
      <form className="form-surface" onSubmit={(e) => void onSubmit(e)} noValidate>
        <h2>{t("dash.profile.password")}</h2>
        {formError ? (
          <p role="alert" className="negative">
            {formError}
          </p>
        ) : null}
        <label className="field">
          <span id="pwd-currentPassword-label">{t("account.currentPassword")}</span>
          <input
            id="pwd-currentPassword"
            aria-labelledby="pwd-currentPassword-label"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            aria-invalid={currentError ? true : undefined}
            aria-describedby={currentError ? "pwd-currentPassword-error" : undefined}
          />
          {currentError ? (
            <small id="pwd-currentPassword-error" className="negative">
              {currentError}
            </small>
          ) : null}
        </label>
        <label className="field">
          <span id="pwd-newPassword-label">{t("account.newPassword")}</span>
          <input
            id="pwd-newPassword"
            aria-labelledby="pwd-newPassword-label"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            aria-invalid={newError ? true : undefined}
            aria-describedby={newError ? "pwd-newPassword-error" : undefined}
          />
          {newError ? (
            <small id="pwd-newPassword-error" className="negative">
              {newError}
            </small>
          ) : null}
        </label>
        <div className="info-box">
          <ShieldCheck size={18} />
          <p>{t("account.newPasswordHint")}</p>
        </div>
        {done ? (
          <div className="info-box" role="status">
            <Check size={18} />
            <p>{t("account.passwordChanged")}</p>
          </div>
        ) : null}
        <button className="primary-button" type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? t("account.changing") : t("account.changePassword")}
        </button>
      </form>
    </Page>
  )
}

function SessionsPage() {
  const { t, language } = useI18n()
  const onExpired = useSessionExpiry()
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formatDate = useCallback(
    (iso: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)),
    [language],
  )

  const load = useCallback(async () => {
    try {
      setSessions(await authApi.sessions())
      setLoadFailed(false)
    } catch (e) {
      onExpired(e)
      setLoadFailed(true)
    }
  }, [onExpired])

  useEffect(() => {
    void load()
  }, [load])

  async function revoke(id: string) {
    setNotice(null)
    setError(null)
    try {
      await authApi.revokeSession(id)
      setNotice(t("account.sessionRevoked"))
      await load()
    } catch (e) {
      onExpired(e)
      setError(t(errorKey(e)))
    }
  }

  async function revokeOthers() {
    setNotice(null)
    setError(null)
    try {
      await authApi.revokeOtherSessions()
      setNotice(t("account.othersRevoked"))
      await load()
    } catch (e) {
      onExpired(e)
      setError(t(errorKey(e)))
    }
  }

  const others = sessions?.filter((s) => !s.current) ?? []

  return (
    <Page className="form-page">
      <Header title={t("dash.profile.sessions")} back />
      <div className="form-surface">
        <h2>{t("account.sessionsTitle")}</h2>
        <p className="body-copy">{t("account.sessionsHelp")}</p>
        {error ? (
          <p role="alert" className="negative">
            {error}
          </p>
        ) : null}
        {notice ? (
          <div className="info-box" role="status">
            <Check size={18} />
            <p>{notice}</p>
          </div>
        ) : null}
        {loadFailed ? (
          <p role="alert" className="negative">
            {t("account.loadFailed")}
          </p>
        ) : null}
        {sessions === null && !loadFailed ? <p role="status">{t("common.states.loading")}</p> : null}
        {sessions ? (
          <>
            <ul className="notice-list">
              {sessions.map((s) => (
                <li key={s.id} className="notice">
                  <span className={s.current ? "notice-icon green" : "notice-icon blue"}>
                    <Smartphone size={18} />
                  </span>
                  <div>
                    <strong>{t("account.startedAt", { date: formatDate(s.createdAt) })}</strong>
                    <p>{t("account.expiresAt", { date: formatDate(s.expiresAt) })}</p>
                    {s.current ? <small>{t("account.currentSession")}</small> : null}
                  </div>
                  {s.current ? (
                    <span />
                  ) : (
                    <button
                      className="small-button"
                      aria-label={t("account.revokeLabel", { date: formatDate(s.createdAt) })}
                      onClick={() => void revoke(s.id)}
                    >
                      {t("account.revoke")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {others.length > 0 ? (
              <button className="primary-button" onClick={() => void revokeOthers()}>
                {t("account.revokeOthers")}
              </button>
            ) : (
              <div className="info-box">
                <CircleHelp size={18} />
                <p>{t("account.noOtherSessions")}</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Page>
  )
}

/* ----------------------------------------------------- Estrutura e rotas */

const TITLE_KEYS: Record<string, string> = {
  "": "home",
  wallet: "wallet",
  plans: "plans",
  deposit: "deposits",
  withdraw: "withdrawals",
  history: "history",
  agreements: "agreements",
  verification: "verification",
  notifications: "notifications",
  support: "support",
  settings: "settings",
  profile: "profile",
  security: "profile",
}

export function AppShell() {
  const location = useLocation()
  const { t, language } = useI18n()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawer = useMemo(() => ({ open: drawerOpen, setOpen: setDrawerOpen }), [drawerOpen])

  useEffect(() => {
    applyTheme(readTheme())
  }, [])

  // O título do separador acompanha a página (acessibilidade).
  useEffect(() => {
    const first = location.pathname.split("/")[1] ?? ""
    const key = TITLE_KEYS[first]
    document.title = key ? `${t(`dash.nav.${key}`)} — KIVORA` : "KIVORA"
  }, [location.pathname, language, t])

  return (
    <div className="app-shell">
      <div className="desktop-rail">
        <Logo height={52} />
        <p>{t("dash.rail.tagline")}</p>
      </div>
      <ProfileDrawerContext.Provider value={drawer}>
        <div className="mobile-app" style={COLUMN_WIDTH}>
          <DashboardRoutes />
          <BottomNav />
          <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </div>
      </ProfileDrawerContext.Provider>
    </div>
  )
}

export function DashboardRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/wallet" element={<WalletPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/plans/:id" element={<PlanDetailPage />} />
      <Route path="/deposit" element={<DepositPage />} />
      <Route path="/withdraw" element={<WithdrawPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/agreements" element={<AgreementsPage />} />
      <Route path="/verification" element={<VerificationPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/data" element={<PersonalDataPage />} />
      <Route path="/profile/contacts" element={<ContactsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/security" element={<SecurityHubPage />} />
      <Route path="/security/password" element={<PasswordPage />} />
      <Route path="/security/sessions" element={<SessionsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** Só mostra o dashboard com sessão válida; sem sessão leva ao login. A autorização real é sempre a do servidor. */
export function Gate({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const { t } = useI18n()

  useEffect(() => {
    if (status === "anonymous") redirectTo(LOGIN_URL)
  }, [status])

  if (status !== "authenticated") {
    return (
      <div className="app-shell">
        <div className="desktop-rail">
          <Logo height={52} />
          <p>{t("dash.rail.tagline")}</p>
        </div>
        <div className="mobile-app" style={COLUMN_WIDTH}>
          <main className="page">
            <header className="topbar">
              <Logo height={32} />
            </header>
            <p role="status">{t("common.states.loading")}</p>
          </main>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <Gate>
        <AppShell />
      </Gate>
    </BrowserRouter>
  )
}
