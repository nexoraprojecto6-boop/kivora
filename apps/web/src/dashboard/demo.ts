/**
 * Dados de EXEMPLO para pré-visualizar todos os ecrãs do dashboard.
 * Nada aqui é real. Desligar com VITE_DEMO_UI=false (os ecrãs voltam a "indisponível").
 * Quando um módulo existir no servidor, troca-se a leitura destes dados pela chamada à API.
 */
export const demoEnabled = (): boolean =>
  import.meta.env["VITE_DEMO_UI"] !== "false"

export type TxKind = "deposit" | "withdraw" | "plan" | "refund"
export type TxStatus = "pending" | "confirmed" | "rejected"
export interface Tx {
  id: string
  kind: TxKind
  amount: number
  status: TxStatus
  date: string
  ref: string
}
export interface Plan {
  id: string
  name: string
  tone: "" | "gold" | "violet" | "sky"
  icon: "gem" | "layers" | "sparkles"
  min: number
  months: number
  risk: "low" | "mid" | "high"
  open: boolean
  fill: number
}

export const ACCOUNT = { total: 250000, available: 200000, reserved: 50000 }
export const WEEK = [3, 5, 4, 7, 6, 9, 8]

const kinds: TxKind[] = ["deposit", "plan", "withdraw", "deposit", "refund", "deposit", "withdraw", "plan"]
const statuses: TxStatus[] = ["confirmed", "confirmed", "pending", "confirmed", "confirmed", "rejected", "confirmed", "pending"]
export const TRANSACTIONS: Tx[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i + 1}`,
  kind: kinds[i % kinds.length] ?? "deposit",
  amount: (i % 5 + 1) * 10000,
  status: statuses[i % statuses.length] ?? "pending",
  date: new Date(Date.UTC(2026, 9, 26 - i * 2)).toISOString(),
  ref: `EX-${String(1000 + i * 7)}`,
}))

export const PLANS: Plan[] = [
  { id: "a", name: "Exemplo A", tone: "", icon: "gem", min: 10000, months: 6, risk: "low", open: true, fill: 40 },
  { id: "b", name: "Exemplo B", tone: "gold", icon: "layers", min: 25000, months: 12, risk: "mid", open: true, fill: 65 },
  { id: "c", name: "Exemplo C", tone: "violet", icon: "sparkles", min: 50000, months: 18, risk: "high", open: false, fill: 0 },
]

export const AGREEMENTS = [
  { id: "terms", version: "1.0", accepted: true },
  { id: "privacy", version: "1.0", accepted: true },
  { id: "risk", version: "1.0", accepted: false },
  { id: "plan", version: "0.1", accepted: false },
] as const

export const NOTIFICATIONS = [
  { id: "n1", tone: "green", icon: "in", read: false },
  { id: "n2", tone: "gold", icon: "out", read: false },
  { id: "n3", tone: "blue", icon: "doc", read: true },
  { id: "n4", tone: "red", icon: "shield", read: true },
] as const
