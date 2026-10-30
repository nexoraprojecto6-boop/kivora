import { useSyncExternalStore } from "react"

/*
 * ARMAZENAMENTO SIMULADO (sem API). Guarda no navegador os métodos de pagamento do utilizador e o
 * depósito em análise, só para as telas funcionarem de ponta a ponta.
 * Na ligação à API este ficheiro é substituído por chamadas ao servidor.
 */

export type RailId = "PAYPAY" | "KWIK" | "EXPRESS" | "REFERENCIA"
export type DepositStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface SavedMethod {
  id: string
  rail: RailId
  /** Titular: nome completo (PayPay, Kwik) ou apelido (Express). */
  holder: string
  /** Número PayPay, IBAN, número Express ou referência. */
  detail: string
}

export interface DepositRecord {
  id: string
  rail: RailId
  amount: number
  status: DepositStatus
  createdAt: number
  /** Já mostrámos o aviso (aprovado/recusado) ao utilizador? */
  noticeSeen: boolean
}

interface State {
  methods: SavedMethod[]
  deposit: DepositRecord | null
}

const KEY = "kivora.deposit.mock.v1"
const EMPTY: State = { methods: [], deposit: null }

function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<State>
    return { methods: Array.isArray(parsed.methods) ? parsed.methods : [], deposit: parsed.deposit ?? null }
  } catch {
    return EMPTY
  }
}

let state: State = load()
const listeners = new Set<() => void>()

function commit(next: State) {
  state = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // sem armazenamento: continua só em memória
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useDepositStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const depositActions = {
  addMethod(m: Omit<SavedMethod, "id">): SavedMethod {
    const method = { ...m, id: uid() }
    commit({ ...state, methods: [...state.methods, method] })
    return method
  },
  removeMethod(id: string) {
    commit({ ...state, methods: state.methods.filter((m) => m.id !== id) })
  },
  createDeposit(rail: RailId, amount: number): DepositRecord {
    const deposit: DepositRecord = { id: uid(), rail, amount, status: "PENDING", createdAt: Date.now(), noticeSeen: false }
    commit({ ...state, deposit })
    return deposit
  },
  /** Decisão do administrador (simulada). */
  decide(status: "APPROVED" | "REJECTED") {
    if (state.deposit) commit({ ...state, deposit: { ...state.deposit, status, noticeSeen: false } })
  },
  dismissNotice() {
    if (!state.deposit) return
    if (state.deposit.status === "PENDING") return
    commit({ ...state, deposit: null })
  },
}
