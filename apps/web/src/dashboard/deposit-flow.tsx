import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import { ArrowLeft, Check, ChevronRight, Clock3, Copy, Plus, ReceiptText, ShieldCheck, Timer, Trash2, Upload, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { DepositDto, PaymentAccountDto, PaymentMethodDto, PaymentRail } from "@kivora/shared"
import { prepareImage } from "../features/verify/image.js"
import { ApiError, platformApi } from "../services/api-client.js"
import { Header, Page } from "./App.js"
import { BrandIcon, type BrandId } from "./bank-icons.js"
import { beginLoading } from "../services/loader-store.js"
import "./deposit-flow.css"

/* ======================================================================================
 * Fluxo de depósito ligado à API.
 *  - métodos e contas do parceiro: definidos pelo administrador (GET /payment-methods?kind=DEPOSIT)
 *  - contas do cliente: GET/POST/DELETE /payment-accounts
 *  - depósito: POST /deposits (devolve a conta do parceiro e o prazo de 1 hora)
 *  - comprovativo: POST /deposits/:id/proof
 * Há um loader em cada passo (mínimo MIN_LOADER_MS), do clique em «Depositar» até ao fim.
 * ====================================================================================== */

const MIN_LOADER_MS = 900
const QUICK_UNITS = [5000, 10000, 25000, 50000, 100000]

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const digits = (v: string) => v.replace(/\D/g, "")

export interface Money {
  currency: string
  fmt: (minor: number) => string
  toMinor: (units: number) => number
}

export function makeMoney(currency: string): Money {
  const fd = new Intl.NumberFormat("pt-AO", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2
  const nf = new Intl.NumberFormat("pt-AO", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: fd })
  const factor = 10 ** fd
  return { currency, fmt: (minor) => nf.format(minor / factor), toMinor: (units) => Math.round(units * factor) }
}

function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return "Algo correu mal. Tente novamente."
  const code = e.fieldErrors[0]?.code
  if (code === "belowMinimum") return "O valor está abaixo do mínimo permitido."
  if (code === "aboveMaximum") return "O valor está acima do máximo permitido."
  if (code === "invalidFile" || code === "fileSize") return "Ficheiro inválido ou demasiado grande. Envie um print ou foto nítida."
  if (code === "invalidTxId") return "ID da transacção inválido."
  if (e.code === "NETWORK") return "Sem ligação. Verifique a internet e tente novamente."
  if (e.code === "RATE_LIMITED") return "Demasiados pedidos. Aguarde um momento."
  if (e.code === "FORBIDDEN") return "Não pode depositar de momento. Verifique se a sua conta está verificada."
  if (e.code === "CONFLICT") return "Já existem demasiados pedidos em aberto. Conclua ou cancele um deles."
  if (e.code === "INVALID_STATE_TRANSITION") return "Este depósito já não pode ser alterado."
  return "Algo correu mal. Tente novamente."
}

/* ------------------------------ serviços e campos ------------------------------ */

type AccountRail = PaymentAccountDto["rail"]

const RAILS: Record<PaymentRail, { name: string; blurb: string; brand: BrandId; instructions: string }> = {
  PAYPAY: {
    name: "PayPay AO", blurb: "Transferência por número de telefone", brand: "paypay",
    instructions: "Abra o PayPay AO, escolha Transferir, introduza o número acima e o valor exacto. Confirme o nome do titular antes de pagar.",
  },
  KWIK: {
    name: "Kwik", blurb: "Transferência para IBAN", brand: "kwik",
    instructions: "No Kwik, escolha Transferir para IBAN, introduza o IBAN acima e o valor exacto. Confirme o nome do titular antes de pagar.",
  },
  EXPRESS: {
    name: "Multicaixa Express", blurb: "Pagamento pelo número Express", brand: "express",
    instructions: "No Multicaixa Express, escolha Transferir, introduza o número acima e o valor exacto. Confirme o nome do titular antes de pagar.",
  },
  REFERENCIA: {
    name: "Referência Multicaixa", blurb: "Pagamento por entidade e referência", brand: "referencia",
    instructions: "No Multicaixa Express ou num ATM, escolha Pagamentos, depois Pagamento por referência, e introduza a entidade, a referência e o valor exacto.",
  },
}
const RAIL_ORDER: PaymentRail[] = ["PAYPAY", "KWIK", "EXPRESS", "REFERENCIA"]

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
const phone = (label: string, hint: string): FieldDef => ({
  key: "detail", label, placeholder: "9XX XXX XXX", inputMode: "tel", hint,
  normalize: (v) => { const d = digits(v); return d.startsWith("244") && d.length > 9 ? d.slice(3) : d },
  validate: (v) => (/^9\d{8}$/.test(v) ? null : "Número inválido. Use 9 dígitos, começando por 9."),
})

const FORMS: Record<AccountRail, FieldDef[]> = {
  PAYPAY: [phone("Número PayPay (telefone)", "O número de telemóvel associado à sua conta PayPay."), fullName],
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
    phone("Número do Multicaixa Express", "O número registado no seu Multicaixa Express."),
    {
      key: "holder", label: "Apelido", placeholder: "Ex.: Silva", inputMode: "text",
      hint: "O apelido do titular da conta Express.",
      normalize: (v) => v.replace(/\s+/g, " ").trim(),
      validate: (v) => (v.length >= 2 ? null : "Escreva o apelido."),
    },
  ],
}

const groupIban = (v: string) => v.replace(/(.{4})/g, "$1 ").trim()
const groupPhone = (v: string) => (/^\d{9}$/.test(v) ? v.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : v)
const showDetail = (a: PaymentAccountDto) => (a.rail === "KWIK" ? groupIban(a.detail) : groupPhone(a.detail))

/* ------------------------------ peças reutilizáveis ------------------------------ */

type ModalTone = "success" | "error" | "warning"

export function DpModal({ tone, title, children, action, onClose }: { tone: ModalTone; title: string; children: ReactNode; action: string; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    btn.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
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

function Option({ brand, name, blurb, onClick, disabled, soon }: { brand: BrandId; name: string; blurb: string; onClick?: () => void; disabled?: boolean; soon?: boolean }) {
  return (
    <button type="button" className="dp-option" disabled={disabled} onClick={onClick}>
      <BrandIcon id={brand} />
      <span className="dp-option__text"><b>{name}</b><small>{blurb}</small></span>
      {soon ? <em className="dp-soon">Em breve</em> : <ChevronRight size={18} />}
    </button>
  )
}

/* ------------------------------ passo 1: método ------------------------------ */

function MethodStep({ onBank }: { onBank: () => void }) {
  return (
    <>
      <StepHead step={1} title="Como quer depositar?" sub="Escolha o método de pagamento." />
      <div className="dp-list">
        <Option brand="angola" name="Banco de Angola" blurb="PayPay AO, Kwik, Multicaixa Express e Referência" onClick={onBank} />
        <Option brand="crypto" name="Criptomoeda" blurb="Bitcoin, USDT e outras" disabled soon />
        <Option brand="card" name="Cartão" blurb="Visa e Mastercard" disabled soon />
      </div>
    </>
  )
}

/* ------------------------------ passo 2: serviço ------------------------------ */

function RailStep({ rails, onPick, onBack }: { rails: PaymentRail[]; onPick: (r: PaymentRail) => void; onBack: () => void }) {
  return (
    <>
      <BackLink onClick={onBack} />
      <StepHead step={2} title="Métodos disponíveis" sub="Estes são os serviços disponíveis neste momento." />
      {rails.length === 0 ? <p className="dp-muted">De momento não há métodos de depósito disponíveis. Tente mais tarde.</p> : null}
      <div className="dp-list">
        {rails.map((id) => <Option key={id} brand={RAILS[id].brand} name={RAILS[id].name} blurb={RAILS[id].blurb} onClick={() => onPick(id)} />)}
      </div>
    </>
  )
}

/* ------------------------------ passo 3: a sua conta ------------------------------ */

function AccountForm({ rail, onSave, onCancel }: { rail: AccountRail; onSave: (v: { holder: string; detail: string }) => void; onCancel: (() => void) | null }) {
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
    if (Object.keys(errs).length === 0) onSave({ holder: clean["holder"] ?? "", detail: clean["detail"] ?? "" })
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

function AccountStep({ rail, accounts, selectedId, onSelect, onSave, onDelete, onContinue, onBack }: {
  rail: AccountRail; accounts: PaymentAccountDto[]; selectedId: string | null; onSelect: (id: string) => void
  onSave: (rail: AccountRail, v: { holder: string; detail: string }) => void; onDelete: (id: string) => void; onContinue: () => void; onBack: () => void
}) {
  const mine = accounts.filter((a) => a.rail === rail)
  const [adding, setAdding] = useState(mine.length === 0)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  return (
    <>
      <BackLink onClick={onBack} />
      <StepHead step={3} title={RAILS[rail].name} sub="Escolha a sua conta ou adicione uma nova." />
      {mine.length > 0 && !adding ? (
        <>
          <div className="dp-list" role="radiogroup" aria-label="Métodos guardados">
            {mine.map((a) => (
              <div key={a.id} className={`dp-saved${selectedId === a.id ? " dp-saved--on" : ""}`}>
                <button type="button" role="radio" aria-checked={selectedId === a.id} className="dp-saved__main" onClick={() => onSelect(a.id)}>
                  <span className="dp-radio" aria-hidden="true">{selectedId === a.id ? <Check size={12} strokeWidth={4} /> : null}</span>
                  <span className="dp-option__text"><b>{a.holder}</b><small>{showDetail(a)}</small></span>
                </button>
                {confirmDel === a.id ? (
                  <span className="dp-confirm">
                    <button type="button" onClick={() => { setConfirmDel(null); onDelete(a.id) }}>Excluir</button>
                    <button type="button" onClick={() => setConfirmDel(null)}>Não</button>
                  </span>
                ) : (
                  <button type="button" className="dp-icon-btn" aria-label={`Excluir ${a.holder}`} onClick={() => setConfirmDel(a.id)}><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="dp-secondary" onClick={() => setAdding(true)}><Plus size={15} /> Adicionar outro</button>
          <button type="button" className="dp-primary" disabled={!selectedId} onClick={onContinue}>Continuar</button>
        </>
      ) : (
        <AccountForm rail={rail} onSave={(v) => onSave(rail, v)} onCancel={mine.length > 0 ? () => setAdding(false) : null} />
      )}
    </>
  )
}

/* ------------------------------ passo 4: valor ------------------------------ */

function AmountStep({ money, method, initialUnits, onContinue, onBack }: {
  money: Money; method: PaymentMethodDto; initialUnits: number; onContinue: (units: number) => void; onBack: () => void
}) {
  const [text, setText] = useState(initialUnits > 0 ? String(initialUnits) : "")
  const [error, setError] = useState("")
  const value = Number(digits(text)) || 0
  const minMinor = method.minMinor
  const maxMinor = method.maxMinor

  function go() {
    const minor = money.toMinor(value)
    if (minMinor !== null && minor < minMinor) return setError(`O valor mínimo é ${money.fmt(minMinor)}.`)
    if (maxMinor !== null && minor > maxMinor) return setError(`O valor máximo é ${money.fmt(maxMinor)}.`)
    onContinue(value)
  }

  return (
    <>
      <BackLink onClick={onBack} />
      <StepHead step={4} title="Qual é o valor total?" sub="Indique quanto vai depositar." />
      <label className="dp-amount">
        <span>Valor ({money.currency})</span>
        <input
          inputMode="numeric"
          placeholder="0"
          value={value > 0 ? value.toLocaleString("pt-AO") : ""}
          aria-invalid={error ? true : undefined}
          onChange={(e) => { setText(e.target.value); setError("") }}
        />
      </label>
      {error ? <p className="dp-error" role="alert">{error}</p> : (
        <p className="dp-muted">
          {minMinor !== null ? `Mínimo ${money.fmt(minMinor)}. ` : ""}{maxMinor !== null ? `Máximo ${money.fmt(maxMinor)}.` : ""}
        </p>
      )}
      <div className="dp-chips">
        {QUICK_UNITS.map((q) => (
          <button key={q} type="button" className={value === q ? "on" : ""} onClick={() => { setText(String(q)); setError("") }}>{money.fmt(money.toMinor(q))}</button>
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

function coordsOf(d: DepositDto, money: Money): { holder: string; lines: { label: string; value: string; copy: boolean }[]; instructions: string } {
  const p = d.payTo
  const rail = d.rail
  const lines: { label: string; value: string; copy: boolean }[] = []
  if (rail === "REFERENCIA") {
    lines.push({ label: "Entidade", value: p.entity, copy: true }, { label: "Referência", value: p.reference, copy: true })
  } else if (rail === "KWIK") {
    lines.push({ label: "IBAN", value: groupIban(p.number.replace(/\s/g, "")), copy: true })
  } else if (rail === "EXPRESS") {
    lines.push({ label: "Número Express", value: groupPhone(p.number), copy: true })
  } else if (rail === "PAYPAY") {
    lines.push({ label: "Número PayPay", value: groupPhone(p.number), copy: true })
  } else if (p.number) {
    lines.push({ label: "Conta", value: p.number, copy: true })
  }
  lines.push({ label: "Valor a transferir", value: money.fmt(d.amountMinor), copy: false })
  const instructions = d.instructions.trim() !== "" ? d.instructions.trim() : rail ? RAILS[rail].instructions : "Faça o pagamento com o valor exacto indicado."
  return { holder: p.holder, lines, instructions }
}

function PayStep({ deposit, money, deadline, onSubmit, onExpire, onCancel }: {
  deposit: DepositDto; money: Money; deadline: number; onSubmit: (file: File, txId: string) => void; onExpire: () => void; onCancel: () => void
}) {
  const coords = useMemo(() => coordsOf(deposit, money), [deposit, money])
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()))
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [txId, setTxId] = useState("")
  const [error, setError] = useState("")
  const expired = useRef(false)
  const expireRef = useRef(onExpire)
  expireRef.current = onExpire

  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, deadline - Date.now())), 1000)
    return () => window.clearInterval(id)
  }, [deadline])

  useEffect(() => {
    if (left === 0 && !expired.current) { expired.current = true; expireRef.current() }
  }, [left])

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
    if (f.type === "application/pdf" && f.size > 1_400_000) return setError("O PDF é demasiado grande. Envie um print do comprovativo.")
    if (f.size > 25 * 1024 * 1024) return setError("O ficheiro é demasiado grande.")
    setFile(f)
  }

  const idOk = /^[A-Za-z0-9\-_/.]{4,60}$/.test(txId.trim())

  function submit() {
    if (!file) return setError("Envie o comprovativo do pagamento.")
    if (!idOk) return setError("Escreva o ID da transacção (4 a 60 letras, números ou - _ / .).")
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
        {coords.holder ? <small className="dp-coords__holder"><ShieldCheck size={14} /> {coords.holder}</small> : null}
        {coords.lines.map((l) => (
          <div key={l.label} className="dp-coords__row">
            <span><small>{l.label}</small><b>{l.value}</b></span>
            {l.copy ? <CopyButton value={l.value} /> : null}
          </div>
        ))}
        <small className="dp-muted">Pedido {deposit.reference}</small>
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

/* ------------------------------ ficheiros ------------------------------ */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.onerror = () => reject(new Error("read"))
    reader.readAsDataURL(file)
  })
}

async function proofPayload(file: File): Promise<{ mime: string; dataBase64: string }> {
  if (file.type === "application/pdf") return { mime: "application/pdf", dataBase64: await fileToBase64(file) }
  return prepareImage(file)
}

/* ------------------------------ fluxo completo ------------------------------ */

type Step = "method" | "rails" | "accounts" | "amount" | "pay"

export function DepositFlow() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>("method")
  const [loader, setLoader] = useState<{ title: string; sub: string } | null>({ title: "A carregar", sub: "A preparar o seu depósito" })
  const [error, setError] = useState("")
  const [methods, setMethods] = useState<PaymentMethodDto[]>([])
  const [money, setMoney] = useState<Money>(() => makeMoney("AOA"))
  const [rail, setRail] = useState<PaymentRail | null>(null)
  const [accounts, setAccounts] = useState<PaymentAccountDto[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [units, setUnits] = useState(0)
  const [deposit, setDeposit] = useState<DepositDto | null>(null)
  const [deadline, setDeadline] = useState(0)
  const [modal, setModal] = useState<"success" | "expired" | null>(null)
  const alive = useRef(true)
  const idemRef = useRef<{ sig: string; key: string } | null>(null)
  /** Quantos loaders estão activos; o ecrã só aparece quando todos terminam. */
  const active = useRef(0)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  /** Mostra o loader (no mínimo MIN_LOADER_MS) enquanto o trabalho decorre. */
  const run = useCallback(async function run<T>(title: string, sub: string, work: () => Promise<T>): Promise<T | null> {
    setError("")
    setLoader({ title, sub })
    active.current += 1
    const endGlobal = beginLoading({ title, sub })
    try {
      const [out] = await Promise.all([work(), wait(MIN_LOADER_MS)])
      return out
    } catch (e) {
      if (alive.current) setError(errorText(e))
      return null
    } finally {
      endGlobal()
      active.current -= 1
      if (alive.current && active.current === 0) setLoader(null)
    }
  }, [])

  /** Mudança de passo com loader. O passo muda por baixo do loader, sem piscar. */
  const nav = useCallback((next: Step, title = "A processar", sub = "Um momento") => {
    void run(title, sub, async () => { setStep(next) })
  }, [run])

  useEffect(() => {
    void run("A carregar", "A preparar o seu depósito", async () => {
      const [m, w] = await Promise.all([platformApi.methods("DEPOSIT"), platformApi.wallet()])
      if (!alive.current) return
      setMethods(m)
      setMoney(makeMoney(w.currency))
    })
  }, [run])

  const rails = useMemo(() => RAIL_ORDER.filter((r) => methods.some((m) => m.rail === r)), [methods])
  /** O servidor ordena os métodos por ordem de apresentação; usa-se o primeiro disponível do serviço. */
  const method = useMemo(() => (rail ? methods.find((m) => m.rail === rail) ?? null : null), [methods, rail])
  const accountRail: AccountRail | null = rail && rail !== "REFERENCIA" ? rail : null

  function chooseRail(r: PaymentRail) {
    setRail(r)
    setAccountId(null)
    if (r === "REFERENCIA") return nav("amount", "A processar", "A preparar o valor")
    void run("A carregar as suas contas", "Os métodos que já guardou", async () => {
      const list = await platformApi.paymentAccounts()
      if (!alive.current) return
      setAccounts(list)
      setAccountId(list.find((a) => a.rail === r)?.id ?? null)
      setStep("accounts")
    })
  }

  function saveAccount(r: AccountRail, v: { holder: string; detail: string }) {
    void run("A guardar o seu método", "Para os próximos depósitos e levantamentos", async () => {
      const saved = await platformApi.addPaymentAccount({ rail: r, ...v })
      if (!alive.current) return
      setAccounts((prev) => [...prev.filter((a) => a.id !== saved.id), saved])
      setAccountId(saved.id)
    })
  }

  function deleteAccount(id: string) {
    void run("A excluir", "A remover o método guardado", async () => {
      await platformApi.removePaymentAccount(id)
      if (!alive.current) return
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      setAccountId((cur) => (cur === id ? null : cur))
    })
  }

  function createDeposit(u: number) {
    if (!method || !rail) return
    setUnits(u)
    const acc = accounts.find((a) => a.id === accountId)
    const note = acc ? `${RAILS[acc.rail].name} · ${acc.detail} · ${acc.holder}`.slice(0, 300) : ""
    const amountMinor = money.toMinor(u)
    const sig = `${method.id}|${amountMinor}|${note}`
    if (idemRef.current?.sig !== sig) idemRef.current = { sig, key: globalThis.crypto.randomUUID() }
    const key = idemRef.current.key
    void run("A preparar o depósito", "A reservar as coordenadas de pagamento", async () => {
      const d = await platformApi.createDeposit({ methodId: method.id, amountMinor, ...(note ? { note } : {}) }, key)
      if (!alive.current) return
      setDeposit(d)
      setDeadline(Date.now() + Math.max(0, Date.parse(d.expiresAt) - Date.parse(d.createdAt)))
      setStep("pay")
    })
  }

  function sendProof(file: File, txId: string) {
    if (!deposit) return
    void run("A enviar o comprovativo", "Não feche esta página", async () => {
      const payload = await proofPayload(file)
      await platformApi.depositProof(deposit.id, { txId, ...payload })
      if (alive.current) setModal("success")
    })
  }

  function cancelDeposit() {
    const id = deposit?.id
    void run("A cancelar", "Um momento", async () => {
      if (id) await platformApi.cancel("DEPOSIT", id).catch(() => undefined)
      if (alive.current) navigate("/")
    })
  }

  const leave = useCallback(() => navigate("/"), [navigate])
  const expire = useCallback(() => {
    if (deposit) void platformApi.cancel("DEPOSIT", deposit.id).catch(() => undefined)
    setModal("expired")
  }, [deposit])

  const selectedLabel = deposit ? money.fmt(deposit.amountMinor) : ""

  return (
    <Page>
      <Header title="Depósito" back />
      <div className="dp-wrap">
        {error ? <p className="dp-error dp-error--box" role="alert">{error}</p> : null}
        {!loader && step === "method" ? <MethodStep onBank={() => nav("rails", "A processar", "A verificar os métodos disponíveis")} /> : null}
        {!loader && step === "rails" ? <RailStep rails={rails} onPick={chooseRail} onBack={() => nav("method")} /> : null}
        {!loader && step === "accounts" && accountRail ? (
          <AccountStep
            key={`${accountRail}-${accounts.filter((a) => a.rail === accountRail).length}`}
            rail={accountRail} accounts={accounts} selectedId={accountId} onSelect={setAccountId}
            onSave={saveAccount} onDelete={deleteAccount}
            onContinue={() => { if (accountId) nav("amount", "A processar", "A preparar o valor") }}
            onBack={() => nav("rails")}
          />
        ) : null}
        {!loader && step === "amount" && method ? (
          <AmountStep money={money} method={method} initialUnits={units} onContinue={createDeposit} onBack={() => nav(accountRail ? "accounts" : "rails")} />
        ) : null}
        {!loader && step === "pay" && deposit ? (
          <PayStep deposit={deposit} money={money} deadline={deadline} onSubmit={sendProof} onExpire={expire} onCancel={cancelDeposit} />
        ) : null}
      </div>

      {modal === "success" ? (
        <DpModal tone="success" title="Confirmação feita com sucesso" action="Voltar ao início" onClose={leave}>
          <p>Recebemos o seu comprovativo de {selectedLabel}. O depósito está em análise e será creditado após a aprovação.</p>
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

const SEEN_KEY = "kivora.deposit.seen"
const NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(-50) : []
  } catch {
    return []
  }
}
function writeSeen(ids: string[]) {
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-50))) } catch { /* sem armazenamento */ }
}

/** «Pendente / Em análise» no painel e o aviso quando o administrador aprova ou recusa um depósito. */
export function DepositHomeStatus() {
  const [items, setItems] = useState<DepositDto[]>([])
  const [seen, setSeen] = useState<string[]>(readSeen)
  const [currency, setCurrency] = useState("AOA")

  const load = useCallback(() => {
    platformApi.deposits({ silent: true }).then(setItems).catch(() => undefined)
    platformApi.wallet({ silent: true }).then((w) => setCurrency(w.currency)).catch(() => undefined)
  }, [])

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", onVisible)
    const timer = window.setInterval(load, 30_000)
    return () => { document.removeEventListener("visibilitychange", onVisible); window.clearInterval(timer) }
  }, [load])

  const money = useMemo(() => makeMoney(currency), [currency])
  const pending = items.filter((d) => d.status === "PENDING" && d.proofSubmitted)
  const total = pending.reduce((sum, d) => sum + d.amountMinor, 0)
  const notice = items.find(
    (d) => (d.status === "REJECTED" || d.status === "CONFIRMED") && !seen.includes(d.id) && d.decidedAt !== null && Date.now() - Date.parse(d.decidedAt) < NOTICE_WINDOW_MS,
  )

  function dismiss(id: string) {
    const next = [...seen, id]
    setSeen(next)
    writeSeen(next)
  }

  return (
    <>
      {pending.length > 0 ? (
        <section className="dp-pending" aria-label="Depósito em análise">
          <span className="dp-pending__icon"><Clock3 size={18} /></span>
          <span className="dp-pending__text">
            <small>Saldo pendente · {pending.length === 1 ? "1 depósito" : `${pending.length} depósitos`}</small>
            <b>{money.fmt(total)}</b>
          </span>
          <em>Em análise</em>
        </section>
      ) : null}

      {notice?.status === "REJECTED" ? (
        <DpModal tone="error" title="Depósito recusado" action="Entendi" onClose={() => dismiss(notice.id)}>
          <p>O seu depósito de {money.fmt(notice.amountMinor)} foi recusado.{notice.decisionNote ? ` Motivo: ${notice.decisionNote}.` : ""} Se já fez a transferência, contacte o suporte com o comprovativo.</p>
        </DpModal>
      ) : null}
      {notice?.status === "CONFIRMED" ? (
        <DpModal tone="success" title="Depósito aprovado" action="Ok" onClose={() => dismiss(notice.id)}>
          <p>O seu depósito de {money.fmt(notice.amountMinor)} foi aprovado e o saldo já foi creditado.</p>
        </DpModal>
      ) : null}
    </>
  )
}
