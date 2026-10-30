import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import {
  ArrowLeft, Banknote, Bitcoin, Check, ChevronRight, Clock3, Copy, CreditCard, Hash, Landmark, Plus,
  ReceiptText, ShieldCheck, Timer, Trash2, Upload, X, type LucideIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Header, Page } from "./App.js"
import { CoinLoader } from "./coin-loader.js"
import { depositActions, useDepositStore, type RailId, type SavedMethod } from "./deposit-store.js"
import "./deposit-flow.css"

/* ======================================================================================
 * Fluxo de depósito (TELAS). Ainda sem API: tudo o que está em `mockApi` é simulado e será
 * substituído por chamadas ao servidor. Os textos estão em português (Angola) num só sítio.
 * ====================================================================================== */

const DEPOSIT_WINDOW_MS = 60 * 60 * 1000
const MIN_AMOUNT = 1000
const MAX_AMOUNT = 5_000_000
const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000]

const fmtKz = (n: number) => new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(n)
const digits = (v: string) => v.replace(/\D/g, "")
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/* ------------------------------ métodos e campos ------------------------------ */

const RAILS: Record<RailId, { name: string; blurb: string; icon: LucideIcon }> = {
  PAYPAY: { name: "PayPay AO", blurb: "Transferência por número de telefone", icon: Landmark },
  KWIK: { name: "Kwik", blurb: "Transferência para IBAN", icon: Banknote },
  EXPRESS: { name: "Multicaixa Express", blurb: "Pagamento pelo número Express", icon: CreditCard },
  REFERENCIA: { name: "Referência Multicaixa", blurb: "Pagamento por entidade e referência", icon: Hash },
}

interface FieldDef {
  key: "detail" | "holder"
  label: string
  placeholder: string
  hint: string
  inputMode: "numeric" | "tel" | "text"
  normalize: (v: string) => string
  validate: (v: string) => string | null
}

const fullName: FieldDef = {
  key: "holder", label: "Nome completo", placeholder: "Ex.: Maria João Silva", inputMode: "text",
  hint: "Exactamente como está registado na conta.",
  normalize: (v) => v.replace(/\s+/g, " ").trim(),
  validate: (v) => (v.split(" ").filter((p) => p.length > 1).length >= 2 ? null : "Escreva o nome completo (nome e apelido)."),
}

const FORMS: Record<Exclude<RailId, "REFERENCIA">, FieldDef[]> = {
  PAYPAY: [
    {
      key: "detail", label: "Número PayPay (telefone)", placeholder: "9XX XXX XXX", inputMode: "tel",
      hint: "O número de telemóvel associado à sua conta PayPay.",
      normalize: (v) => { const d = digits(v); return d.startsWith("244") && d.length > 9 ? d.slice(3) : d },
      validate: (v) => (/^9\d{8}$/.test(v) ? null : "Número inválido. Use 9 dígitos, começando por 9."),
    },
    fullName,
  ],
  KWIK: [
    {
      key: "detail", label: "IBAN", placeholder: "AO06 0000 0000 0000 0000 0000 0", inputMode: "text",
      hint: "O IBAN angolano começa por AO06 e tem 25 caracteres.",
      normalize: (v) => v.replace(/\s/g, "").toUpperCase(),
      validate: (v) => (/^AO06\d{21}$/.test(v) ? null : "IBAN inválido. Deve ter AO06 seguido de 21 dígitos."),
    },
    fullName,
  ],
  EXPRESS: [
    {
      key: "detail", label: "Número do Multicaixa Express", placeholder: "9XX XXX XXX", inputMode: "tel",
      hint: "O número registado no seu Multicaixa Express.",
      normalize: (v) => { const d = digits(v); return d.startsWith("244") && d.length > 9 ? d.slice(3) : d },
      validate: (v) => (/^\d{9}$/.test(v) ? null : "Número inválido. Use 9 dígitos."),
    },
    {
      key: "holder", label: "Apelido", placeholder: "Ex.: Silva", inputMode: "text",
      hint: "O apelido do titular da conta Express.",
      normalize: (v) => v.replace(/\s+/g, " ").trim(),
      validate: (v) => (v.length >= 2 ? null : "Escreva o apelido."),
    },
  ],
}

const groupIban = (v: string) => v.replace(/(.{4})/g, "$1 ").trim()
const groupPhone = (v: string) => v.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")

function showDetail(m: SavedMethod): string {
  if (m.rail === "KWIK") return groupIban(m.detail)
  if (m.rail === "PAYPAY" || m.rail === "EXPRESS") return groupPhone(m.detail)
  return m.detail
}

/* ------------------------------ SIMULAÇÃO DO SERVIDOR ------------------------------ */

interface Coords { lines: { label: string; value: string }[]; holder: string; instructions: string }

const MOCK_REFERENCES = [
  { id: "ref1", entity: "00000", reference: "000 000 001" },
  { id: "ref2", entity: "00000", reference: "000 000 002" },
  { id: "ref3", entity: "00000", reference: "000 000 003" },
]

function mockCoords(rail: RailId, amount: number): Coords {
  const amountLine = { label: "Valor a transferir", value: fmtKz(amount) }
  switch (rail) {
    case "PAYPAY":
      return { holder: "Conta do parceiro (exemplo)", lines: [{ label: "Número PayPay", value: "900 000 000" }, amountLine],
        instructions: "Abra o PayPay AO, escolha Transferir, introduza o número acima e o valor exacto. Confirme o nome do parceiro antes de pagar." }
    case "KWIK":
      return { holder: "Conta do parceiro (exemplo)", lines: [{ label: "IBAN", value: "AO06 0000 0000 0000 0000 0000 0" }, amountLine],
        instructions: "No Kwik, escolha Transferir para IBAN, introduza o IBAN acima e o valor exacto. Confirme o nome do titular antes de pagar." }
    case "EXPRESS":
      return { holder: "Conta do parceiro (exemplo)", lines: [{ label: "Número Express", value: "900 000 000" }, amountLine],
        instructions: "No Multicaixa Express, escolha Transferir, introduza o número acima e o valor exacto. Confirme o nome antes de pagar." }
    case "REFERENCIA":
      return { holder: "Pagamento por referência", lines: [{ label: "Entidade", value: "00000" }, { label: "Referência", value: "000 000 001" }, amountLine],
        instructions: "Num ATM ou no Multicaixa Express, escolha Pagamentos, depois Pagamento por referência, e introduza a entidade, a referência e o valor exacto." }
  }
}

const mockApi = {
  /** O servidor escolhe os métodos disponíveis no momento. */
  async availableRails(): Promise<RailId[]> { await wait(2800); return ["PAYPAY", "KWIK", "EXPRESS", "REFERENCIA"] },
  async saveMethod(m: Omit<SavedMethod, "id">): Promise<SavedMethod> { await wait(2200); return depositActions.addMethod(m) },
  async prepareDeposit(rail: RailId, amount: number): Promise<Coords> { await wait(2400); return mockCoords(rail, amount) },
  async submitProof(): Promise<void> { await wait(2400) },
}

/* ------------------------------ peças reutilizáveis ------------------------------ */

type ModalTone = "success" | "error" | "warning"

export function DpModal({ tone, title, children, action, onClose }: { tone: ModalTone; title: string; children: ReactNode; action: string; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    btn.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  const Icon = tone === "success" ? Check : tone === "error" ? X : Clock3
  return (
    <div className="dp-overlay" role="presentation">
      <div className={`dp-modal dp-modal--${tone}`} role="dialog" aria-modal="true" aria-labelledby="dp-modal-title">
        <span className="dp-modal__icon" aria-hidden="true"><Icon size={34} strokeWidth={3} /></span>
        <h2 id="dp-modal-title">{title}</h2>
        <div className="dp-modal__body">{children}</div>
        <button ref={btn} type="button" className="dp-modal__btn" onClick={onClose}>{action}</button>
      </div>
    </div>
  )
}

function BackLink({ onClick, label = "Voltar" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="dp-back" onClick={onClick}><ArrowLeft size={15} /> {label}</button>
}

function StepHead({ step, title, sub }: { step: number; title: string; sub: string }) {
  return (
    <div className="dp-head">
      <div className="dp-progress" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step} aria-label={`Passo ${step} de 5`}>
        <i style={{ width: `${(step / 5) * 100}%` }} />
      </div>
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  )
}

/* ------------------------------ passo 1: método ------------------------------ */

function MethodStep({ onBank }: { onBank: () => void }) {
  const items: { id: string; name: string; blurb: string; icon: LucideIcon; ready: boolean }[] = [
    { id: "bank", name: "Banco de Angola", blurb: "PayPay AO, Kwik, Multicaixa Express e Referência", icon: Landmark, ready: true },
    { id: "crypto", name: "Criptomoeda", blurb: "Bitcoin, USDT e outras", icon: Bitcoin, ready: false },
    { id: "card", name: "Cartão", blurb: "Visa e Mastercard", icon: CreditCard, ready: false },
  ]
  return (
    <>
      <StepHead step={1} title="Como quer depositar?" sub="Escolha o método de pagamento." />
      <div className="dp-list">
        {items.map((it) => (
          <button key={it.id} type="button" className="dp-option" disabled={!it.ready} onClick={it.ready ? onBank : undefined}>
            <span className="dp-option__icon"><it.icon size={20} /></span>
            <span className="dp-option__text"><b>{it.name}</b><small>{it.blurb}</small></span>
            {it.ready ? <ChevronRight size={18} /> : <em className="dp-soon">Em breve</em>}
          </button>
        ))}
      </div>
    </>
  )
}

/* ------------------------------ passo 2: serviço ------------------------------ */

function RailStep({ rails, onPick, onBack }: { rails: RailId[]; onPick: (r: RailId) => void; onBack: () => void }) {
  return (
    <>
      <BackLink onClick={onBack} />
      <StepHead step={2} title="Métodos disponíveis" sub="Estes são os serviços disponíveis neste momento." />
      <div className="dp-list">
        {rails.map((id) => {
          const r = RAILS[id]
          return (
            <button key={id} type="button" className="dp-option" onClick={() => onPick(id)}>
              <span className="dp-option__icon"><r.icon size={20} /></span>
              <span className="dp-option__text"><b>{r.name}</b><small>{r.blurb}</small></span>
              <ChevronRight size={18} />
            </button>
          )
        })}
      </div>
    </>
  )
}

/* ------------------------------ passo 3: a sua conta ------------------------------ */

function MethodForm({ rail, onSave, onCancel }: { rail: Exclude<RailId, "REFERENCIA">; onSave: (m: Omit<SavedMethod, "id">) => void; onCancel: (() => void) | null }) {
  const fields = FORMS[rail]
  const [values, setValues] = useState<Record<string, string>>({ detail: "", holder: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const clean: Record<string, string> = {}
    const errs: Record<string, string> = {}
    for (const f of fields) {
      const v = f.normalize(values[f.key] ?? "")
      clean[f.key] = v
      const msg = f.validate(v)
      if (msg) errs[f.key] = msg
    }
    setErrors(errs)
    if (Object.keys(errs).length === 0) onSave({ rail, detail: clean["detail"] ?? "", holder: clean["holder"] ?? "" })
  }

  return (
    <form className="dp-card" onSubmit={submit} noValidate>
      <h3>Novo método {RAILS[rail].name}</h3>
      <p className="dp-muted">É a conta que usaremos também para os seus levantamentos.</p>
      {fields.map((f) => (
        <label key={f.key} className="dp-field">
          <span>{f.label}</span>
          <input
            value={values[f.key] ?? ""}
            inputMode={f.inputMode}
            placeholder={f.placeholder}
            aria-invalid={errors[f.key] ? true : undefined}
            onChange={(e) => { setValues((p) => ({ ...p, [f.key]: e.target.value })); setErrors((p) => ({ ...p, [f.key]: "" })) }}
          />
          <small>{f.hint}</small>
          {errors[f.key] ? <strong role="alert">{errors[f.key]}</strong> : null}
        </label>
      ))}
      <button type="submit" className="dp-primary">Guardar método</button>
      {onCancel ? <button type="button" className="dp-secondary" onClick={onCancel}>Cancelar</button> : null}
    </form>
  )
}

function AccountStep({ rail, methods, selectedId, onSelect, onSave, onContinue, onBack }: {
  rail: RailId; methods: SavedMethod[]; selectedId: string | null; onSelect: (id: string) => void
  onSave: (m: Omit<SavedMethod, "id">) => void; onContinue: () => void; onBack: () => void
}) {
  const mine = methods.filter((m) => m.rail === rail)
  const [adding, setAdding] = useState(mine.length === 0)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const meta = RAILS[rail]

  return (
    <>
      <BackLink onClick={onBack} />
      <StepHead step={3} title={meta.name} sub={rail === "REFERENCIA" ? "Escolha a referência de pagamento." : "Escolha a sua conta ou adicione uma nova."} />

      {rail === "REFERENCIA" ? (
        <div className="dp-list">
          {MOCK_REFERENCES.map((r) => (
            <button key={r.id} type="button" className="dp-option" onClick={() => onSave({ rail, holder: `Entidade ${r.entity}`, detail: r.reference })}>
              <span className="dp-option__icon"><Hash size={20} /></span>
              <span className="dp-option__text"><b>Entidade {r.entity}</b><small>Referência {r.reference}</small></span>
              <ChevronRight size={18} />
            </button>
          ))}
          <p className="dp-muted">Referências de exemplo. Serão geradas pelo servidor.</p>
        </div>
      ) : null}

      {mine.length > 0 && !adding ? (
        <>
          <div className="dp-list" role="radiogroup" aria-label="Métodos guardados">
            {mine.map((m) => (
              <div key={m.id} className={`dp-saved${selectedId === m.id ? " dp-saved--on" : ""}`}>
                <button type="button" role="radio" aria-checked={selectedId === m.id} className="dp-saved__main" onClick={() => onSelect(m.id)}>
                  <span className="dp-radio" aria-hidden="true">{selectedId === m.id ? <Check size={12} strokeWidth={4} /> : null}</span>
                  <span className="dp-option__text"><b>{m.holder}</b><small>{showDetail(m)}</small></span>
                </button>
                {confirmDel === m.id ? (
                  <span className="dp-confirm">
                    <button type="button" onClick={() => { depositActions.removeMethod(m.id); setConfirmDel(null) }}>Excluir</button>
                    <button type="button" onClick={() => setConfirmDel(null)}>Não</button>
                  </span>
                ) : (
                  <button type="button" className="dp-icon-btn" aria-label={`Excluir ${m.holder}`} onClick={() => setConfirmDel(m.id)}><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
          {rail !== "REFERENCIA" ? <button type="button" className="dp-secondary" onClick={() => setAdding(true)}><Plus size={15} /> Adicionar outro</button> : null}
          <button type="button" className="dp-primary" disabled={!selectedId} onClick={onContinue}>Continuar</button>
        </>
      ) : null}

      {rail !== "REFERENCIA" && (adding || mine.length === 0) ? (
        <MethodForm rail={rail} onSave={onSave} onCancel={mine.length > 0 ? () => setAdding(false) : null} />
      ) : null}
    </>
  )
}

/* ------------------------------ passo 4: valor ------------------------------ */

function AmountStep({ initial, onContinue, onBack }: { initial: number; onContinue: (n: number) => void; onBack: () => void }) {
  const [text, setText] = useState(initial > 0 ? String(initial) : "")
  const [error, setError] = useState("")
  const value = Number(digits(text)) || 0

  function go() {
    if (value < MIN_AMOUNT) return setError(`O valor mínimo é ${fmtKz(MIN_AMOUNT)}.`)
    if (value > MAX_AMOUNT) return setError(`O valor máximo é ${fmtKz(MAX_AMOUNT)}.`)
    onContinue(value)
  }

  return (
    <>
      <BackLink onClick={onBack} />
      <StepHead step={4} title="Qual é o valor total?" sub="Indique quanto vai depositar." />
      <label className="dp-amount">
        <span>Valor em Kz</span>
        <input
          inputMode="numeric"
          placeholder="0"
          value={value > 0 ? value.toLocaleString("pt-AO") : ""}
          aria-invalid={error ? true : undefined}
          onChange={(e) => { setText(e.target.value); setError("") }}
        />
      </label>
      {error ? <p className="dp-error" role="alert">{error}</p> : <p className="dp-muted">Mínimo {fmtKz(MIN_AMOUNT)}.</p>}
      <div className="dp-chips">
        {QUICK_AMOUNTS.map((q) => (
          <button key={q} type="button" className={value === q ? "on" : ""} onClick={() => { setText(String(q)); setError("") }}>{fmtKz(q)}</button>
        ))}
      </div>
      <button type="button" className="dp-primary" disabled={value === 0} onClick={go}>Continuar</button>
    </>
  )
}

/* ------------------------------ passo 5: pagar e enviar comprovativo ------------------------------ */

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ""))
      setDone(true)
      window.setTimeout(() => setDone(false), 1600)
    } catch {
      // o utilizador pode copiar manualmente
    }
  }
  return <button type="button" className="dp-copy" onClick={() => void copy()} aria-label="Copiar">{done ? <Check size={14} /> : <Copy size={14} />}{done ? "Copiado" : "Copiar"}</button>
}

function PayStep({ coords, deadline, onSubmit, onExpire, onCancel }: {
  coords: Coords; deadline: number; onSubmit: (file: File, txId: string) => void; onExpire: () => void; onCancel: () => void
}) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()))
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [txId, setTxId] = useState("")
  const [error, setError] = useState("")
  const expired = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, deadline - Date.now())), 1000)
    return () => window.clearInterval(id)
  }, [deadline])

  useEffect(() => {
    if (left === 0 && !expired.current) { expired.current = true; onExpire() }
  }, [left, onExpire])

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pick(f: File | undefined) {
    setError("")
    if (!f) return setFile(null)
    if (!(f.type.startsWith("image/") || f.type === "application/pdf")) return setError("Envie uma imagem (print ou foto) ou um PDF.")
    if (f.size > 8 * 1024 * 1024) return setError("O ficheiro é demasiado grande (máximo 8 MB).")
    setFile(f)
  }

  const idOk = /^[A-Za-z0-9\-_/.]{4,40}$/.test(txId.trim())

  function submit() {
    if (!file) return setError("Envie o comprovativo do pagamento.")
    if (!idOk) return setError("Escreva o ID da transacção que aparece no comprovativo.")
    onSubmit(file, txId.trim())
  }

  return (
    <>
      <div className="dp-timer-bar">
        <BackLink onClick={onCancel} label="Cancelar" />
        <span className={`dp-timer${left < 5 * 60 * 1000 ? " dp-timer--low" : ""}`} role="timer" aria-label="Tempo restante para concluir">
          <Timer size={14} /> {mmss(left)}
        </span>
      </div>
      <StepHead step={5} title="Faça a transferência" sub="Pague exactamente o valor indicado para esta conta parceira." />

      <section className="dp-card dp-coords" aria-label="Coordenadas de pagamento">
        <small className="dp-coords__holder"><ShieldCheck size={14} /> {coords.holder}</small>
        {coords.lines.map((l) => (
          <div key={l.label} className="dp-coords__row">
            <span><small>{l.label}</small><b>{l.value}</b></span>
            {l.label !== "Valor a transferir" ? <CopyButton value={l.value} /> : null}
          </div>
        ))}
      </section>

      <p className="dp-instructions">{coords.instructions} Depois envie aqui um comprovativo <b>claro e nítido</b> (print ou foto).</p>

      <div className="dp-card">
        <span className="dp-label">Comprovativo</span>
        <label className={`dp-upload${file ? " dp-upload--on" : ""}`}>
          {preview ? <img src={preview} alt="Pré-visualização do comprovativo" /> : <ReceiptText size={28} aria-hidden="true" />}
          <span>{file ? file.name : "Toque para enviar print, foto ou PDF"}</span>
          <em><Upload size={14} /> {file ? "Trocar ficheiro" : "Escolher ficheiro"}</em>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <label className="dp-field">
          <span>ID da transacção</span>
          <input value={txId} placeholder="Ex.: 20241030123456" autoComplete="off" onChange={(e) => { setTxId(e.target.value); setError("") }} />
          <small>O código que aparece no comprovativo do pagamento.</small>
        </label>
        {error ? <p className="dp-error" role="alert">{error}</p> : null}
        <button type="button" className="dp-primary" disabled={!file || !idOk} onClick={submit}>Confirmar depósito</button>
      </div>
    </>
  )
}

/* ------------------------------ fluxo completo ------------------------------ */

type Step = "method" | "rails" | "accounts" | "amount" | "pay"

export function DepositFlow() {
  const navigate = useNavigate()
  const { methods } = useDepositStore()
  const [step, setStep] = useState<Step>("method")
  const [loader, setLoader] = useState<{ title: string; sub: string } | null>(null)
  const [error, setError] = useState("")
  const [rails, setRails] = useState<RailId[]>([])
  const [rail, setRail] = useState<RailId | null>(null)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [deadline, setDeadline] = useState(0)
  const [modal, setModal] = useState<"success" | "expired" | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  async function run<T>(title: string, sub: string, work: () => Promise<T>): Promise<T | null> {
    setError("")
    setLoader({ title, sub })
    try {
      return await work()
    } catch {
      if (alive.current) setError("Não foi possível concluir. Tente novamente.")
      return null
    } finally {
      if (alive.current) setLoader(null)
    }
  }

  async function chooseBank() {
    const r = await run("A processar", "A verificar os métodos disponíveis neste momento", mockApi.availableRails)
    if (r) { setRails(r); setStep("rails") }
  }

  function chooseRail(r: RailId) {
    setRail(r)
    setMethodId(methods.find((m) => m.rail === r)?.id ?? null)
    setStep("accounts")
  }

  async function saveMethod(m: Omit<SavedMethod, "id">) {
    const saved = await run("A guardar o seu método", "Para os próximos depósitos e levantamentos", () => mockApi.saveMethod(m))
    if (saved) setMethodId(saved.id)
  }

  async function chooseAmount(n: number) {
    if (!rail) return
    setAmount(n)
    const c = await run("A preparar o depósito", "A reservar as coordenadas de pagamento", () => mockApi.prepareDeposit(rail, n))
    if (c) { setCoords(c); setDeadline(Date.now() + DEPOSIT_WINDOW_MS); setStep("pay") }
  }

  async function sendProof() {
    if (!rail) return
    const ok = await run("A enviar o comprovativo", "Não feche esta página", async () => { await mockApi.submitProof(); return true })
    if (ok) { depositActions.createDeposit(rail, amount); setModal("success") }
  }

  const leave = () => navigate("/")
  const expire = useMemo(() => () => setModal("expired"), [])
  const selected = methods.find((m) => m.id === methodId) ?? null

  return (
    <Page>
      <Header title="Depósito" back />
      <div className="dp-wrap">
        {error ? <p className="dp-error dp-error--box" role="alert">{error}</p> : null}
        {loader ? <CoinLoader title={loader.title} subtitle={loader.sub} /> : null}
        {!loader && step === "method" ? <MethodStep onBank={() => void chooseBank()} /> : null}
        {!loader && step === "rails" ? <RailStep rails={rails} onPick={chooseRail} onBack={() => setStep("method")} /> : null}
        {!loader && step === "accounts" && rail ? (
          <AccountStep
            key={`${rail}-${methods.filter((m) => m.rail === rail).length}`}
            rail={rail} methods={methods} selectedId={methodId} onSelect={setMethodId}
            onSave={(m) => void saveMethod(m)} onContinue={() => { if (selected) setStep("amount") }} onBack={() => setStep("rails")}
          />
        ) : null}
        {!loader && step === "amount" ? <AmountStep initial={amount} onContinue={(n) => void chooseAmount(n)} onBack={() => setStep("accounts")} /> : null}
        {!loader && step === "pay" && coords ? (
          <PayStep coords={coords} deadline={deadline} onSubmit={() => void sendProof()} onExpire={expire} onCancel={leave} />
        ) : null}
      </div>

      {modal === "success" ? (
        <DpModal tone="success" title="Confirmação feita com sucesso" action="Voltar ao início" onClose={leave}>
          <p>Recebemos o seu comprovativo de {fmtKz(amount)}. O depósito está em análise e será creditado após a aprovação.</p>
        </DpModal>
      ) : null}
      {modal === "expired" ? (
        <DpModal tone="warning" title="Tempo esgotado" action="Voltar ao início" onClose={leave}>
          <p>Passou 1 hora sem o envio do comprovativo, por isso o depósito foi cancelado. Se já pagou, contacte o suporte.</p>
        </DpModal>
      ) : null}
    </Page>
  )
}

/* ------------------------------ painel: saldo pendente e avisos ------------------------------ */

/** Mostra «Pendente / Em análise» no painel e o aviso quando o depósito é aprovado ou recusado. */
export function DepositHomeStatus() {
  const { deposit } = useDepositStore()
  if (!deposit) return null
  const rail = RAILS[deposit.rail].name

  return (
    <>
      {deposit.status === "PENDING" ? (
        <section className="dp-pending" aria-label="Depósito em análise">
          <span className="dp-pending__icon"><Clock3 size={18} /></span>
          <span className="dp-pending__text">
            <small>Saldo pendente · {rail}</small>
            <b>{fmtKz(deposit.amount)}</b>
          </span>
          <em>Em análise</em>
          {import.meta.env.DEV ? (
            <span className="dp-demo">
              <button type="button" onClick={() => depositActions.decide("APPROVED")}>Simular aprovar</button>
              <button type="button" onClick={() => depositActions.decide("REJECTED")}>Simular recusar</button>
            </span>
          ) : null}
        </section>
      ) : null}

      {deposit.status === "REJECTED" ? (
        <DpModal tone="error" title="Depósito recusado" action="Entendi" onClose={depositActions.dismissNotice}>
          <p>O seu depósito de {fmtKz(deposit.amount)} foi recusado. Se já fez a transferência, contacte o suporte com o comprovativo.</p>
        </DpModal>
      ) : null}
      {deposit.status === "APPROVED" ? (
        <DpModal tone="success" title="Depósito aprovado" action="Ok" onClose={depositActions.dismissNotice}>
          <p>O seu depósito de {fmtKz(deposit.amount)} foi aprovado.</p>
        </DpModal>
      ) : null}
    </>
  )
}
