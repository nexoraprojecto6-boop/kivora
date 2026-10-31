import { useSyncExternalStore } from "react"
import type { WalletDto } from "@kivora/shared"
import { ApiError, platformApi, realtimeSocketUrl } from "./api-client.js"

/*
 * Tempo real: o servidor avisa o que mudou (saldo, pedidos, notificações) e este ficheiro só distribui os avisos.
 *  - Ligação por WebSocket com um bilhete de uso único (30 s) pedido com a sessão; nada de cookies nem tokens no socket.
 *  - Saldo: o servidor envia o saldo já calculado. O ecrã mostra esse valor; não há contas no cliente.
 *  - Outros avisos só dizem "esta lista mudou": a lista é pedida de novo ao servidor, em silêncio (sem loader).
 *  - Se a ligação cair, tenta de novo com espera crescente e, ao voltar, refresca tudo. Sem ligação a app funciona como antes.
 */
export type Scope = "wallet" | "deposits" | "withdrawals" | "subscriptions" | "verification" | "account" | "referrals" | "support" | "notifications" | "history"
const ALL: Scope[] = ["wallet", "deposits", "withdrawals", "subscriptions", "verification", "account", "referrals", "support", "notifications", "history"]
const isScope = (v: unknown): v is Scope => typeof v === "string" && (ALL as string[]).includes(v)

const scopeSubs = new Map<Scope, Set<() => void>>()
export function onScope(scope: Scope, fn: () => void): () => void {
  let s = scopeSubs.get(scope)
  if (!s) scopeSubs.set(scope, (s = new Set()))
  s.add(fn)
  return () => { s?.delete(fn) }
}
const fire = (scope: Scope): void => scopeSubs.get(scope)?.forEach((f) => f())

/* ----- saldo em directo ----- */
let wallet: WalletDto | null = null
const walletSubs = new Set<() => void>()
export const getWalletSnapshot = (): WalletDto | null => wallet
export function subscribeWallet(fn: () => void): () => void {
  walletSubs.add(fn)
  return () => { walletSubs.delete(fn) }
}
function setWallet(w: WalletDto | null): void {
  wallet = w
  walletSubs.forEach((f) => f())
}

/* ----- estado da ligação ----- */
export type RealtimeStatus = "off" | "connecting" | "live"
let status: RealtimeStatus = "off"
const statusSubs = new Set<() => void>()
function setStatus(s: RealtimeStatus): void {
  if (s === status) return
  status = s
  statusSubs.forEach((f) => f())
}
export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore((fn) => { statusSubs.add(fn); return () => { statusSubs.delete(fn) } }, () => status, () => "off")
}

function resync(): void {
  setWallet(null)
  for (const s of ALL) fire(s)
}

/** Trata uma mensagem do servidor e devolve o tipo (ou null). */
function handle(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 20_000) return null
  let m: { type?: unknown; wallet?: unknown; scope?: unknown; scopes?: unknown }
  try { m = JSON.parse(raw) as typeof m } catch { return null }
  switch (m.type) {
    case "wallet": {
      const w = m.wallet as Partial<WalletDto> | undefined
      if (w && typeof w.available === "number" && typeof w.currency === "string") setWallet(w as WalletDto)
      break
    }
    case "refresh":
      if (isScope(m.scope) && m.scope !== "wallet") fire(m.scope)
      break
    case "notification":
      if (Array.isArray(m.scopes)) for (const s of m.scopes) if (isScope(s) && s !== "wallet") fire(s)
      break
    case "resync":
      resync()
      break
  }
  return typeof m.type === "string" ? m.type : null
}

function run(): () => void {
  let ws: WebSocket | null = null
  let stopped = false
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let pendingTicket = ""

  const retry = (): void => {
    if (stopped || retryTimer) return
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt++, 5)) + Math.random() * 500
    retryTimer = setTimeout(() => { retryTimer = null; void connect() }, delay)
  }

  const connect = async (): Promise<void> => {
    if (stopped || (ws && ws.readyState <= 1)) return
    setStatus("connecting")
    let socket: WebSocket
    try {
      const { ticket } = await platformApi.realtimeTicket()
      if (stopped) return
      socket = new WebSocket(realtimeSocketUrl())
      pendingTicket = ticket
    } catch (e) {
      setStatus("off")
      if (e instanceof ApiError && e.status === 401) return // sem sessão: não insistir
      return retry()
    }
    ws = socket
    // O bilhete vai na primeira mensagem (nunca no endereço). A ligação só conta como activa quando o servidor responde "hello".
    socket.onopen = () => {
      socket.send(JSON.stringify({ t: "auth", ticket: pendingTicket }))
      pendingTicket = ""
    }
    socket.onmessage = (ev: MessageEvent) => {
      if (handle(ev.data) !== "hello") return
      attempt = 0
      setStatus("live")
      resync()
      pingTimer = setInterval(() => { if (socket.readyState === 1) socket.send('{"t":"ping"}') }, 25_000)
    }
    socket.onerror = () => undefined
    socket.onclose = (ev: CloseEvent) => {
      if (pingTimer) clearInterval(pingTimer)
      pingTimer = null
      if (ws === socket) ws = null
      setStatus("off")
      if (ev.code === 4401) return // a sessão terminou
      retry()
    }
  }

  const onVisible = (): void => {
    if (!document.hidden && !stopped && (!ws || ws.readyState > 1)) { attempt = 0; if (retryTimer) { clearTimeout(retryTimer); retryTimer = null } void connect() }
  }
  document.addEventListener("visibilitychange", onVisible)
  window.addEventListener("online", onVisible)
  void connect()

  return () => {
    stopped = true
    document.removeEventListener("visibilitychange", onVisible)
    window.removeEventListener("online", onVisible)
    if (retryTimer) clearTimeout(retryTimer)
    if (pingTimer) clearInterval(pingTimer)
    ws?.close(1000, "bye")
    setWallet(null)
    setStatus("off")
  }
}

let refs = 0
let stop: (() => void) | null = null
/** Liga o tempo real (uma só ligação, mesmo que seja chamado várias vezes). Devolve a função que desliga. */
export function startRealtime(): () => void {
  if (import.meta.env.MODE === "test" || typeof WebSocket === "undefined") return () => undefined
  if (refs++ === 0) stop = run()
  return () => {
    if (--refs === 0) { stop?.(); stop = null }
  }
}
