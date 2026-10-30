/**
 * Estado do loader global. Cada pedido à API (ver api-client.ts) regista-se aqui; o ecrã de
 * carregamento aparece enquanto houver pelo menos um activo e fica no mínimo MIN_VISIBLE_MS
 * (evita piscar em pedidos muito rápidos). Pedidos em segundo plano usam { silent: true }.
 */
export interface LoaderLabel { title?: string; sub?: string }
export interface LoaderState { visible: boolean; title: string | null; sub: string | null }

const MIN_VISIBLE_MS = 500
const HIDDEN: LoaderState = { visible: false, title: null, sub: null }

const entries = new Map<number, LoaderLabel>()
const listeners = new Set<() => void>()
let nextId = 1
let state: LoaderState = HIDDEN
let shownAt = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null

function publish(next: LoaderState) {
  if (next.visible === state.visible && next.title === state.title && next.sub === state.sub) return
  state = next
  listeners.forEach((l) => l())
}

function sync() {
  if (entries.size > 0) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
    if (!state.visible) shownAt = Date.now()
    let label: LoaderLabel = {}
    for (const l of entries.values()) if (l.title) label = l // o último texto explícito ganha
    publish({ visible: true, title: label.title ?? null, sub: label.sub ?? null })
    return
  }
  const wait = MIN_VISIBLE_MS - (Date.now() - shownAt)
  if (wait > 0) {
    if (!hideTimer) hideTimer = setTimeout(() => { hideTimer = null; if (entries.size === 0) publish(HIDDEN) }, wait)
  } else {
    publish(HIDDEN)
  }
}

/** Mostra o loader até a função devolvida ser chamada. */
export function beginLoading(label: LoaderLabel = {}): () => void {
  const id = nextId++
  entries.set(id, label)
  sync()
  let done = false
  return () => {
    if (done) return
    done = true
    entries.delete(id)
    sync()
  }
}

/** Atalho: mostra o loader enquanto `work` decorre. */
export async function withLoader<T>(label: LoaderLabel, work: () => Promise<T>): Promise<T> {
  const end = beginLoading(label)
  try { return await work() } finally { end() }
}

export function subscribeLoader(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export const getLoaderState = (): LoaderState => state
