import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import {
  ArrowDownToLine, ArrowRight, ArrowUpFromLine, Bell, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, FileText, Fingerprint,
  Gem, Landmark, Layers, PieChart, Receipt, Search, ShieldCheck, Sparkles, Upload, WalletCards,
} from "lucide-react"
import type { PaymentMethodDto, PlanDto, TransactionDto, VerificationDocType, VerificationFileKind, WalletDto } from "@kivora/shared"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../features/auth/AuthContext.js"
import { useI18n } from "../i18n/I18nProvider.js"
import { ApiError, platformApi } from "../services/api-client.js"
import { ActionTile, Header, Page, SectionTitle } from "./App.js"
import { InviteCard } from "./invite.js"

/* ============================== base: carregar, erros, dinheiro ============================== */

interface Loaded<T> { data: T | null; error: unknown; loading: boolean; reload: () => void }

function useLoad<T>(fn: () => Promise<T>, deps: readonly unknown[]): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error: unknown) => live && setState({ data: null, error, loading: false }),
    )
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { ...state, reload: useCallback(() => setTick((n) => n + 1), []) }
}

function useS() {
  const { t } = useI18n()
  return (key: string, params?: Record<string, string>) => t(`dash.s.${key}`, params)
}

/** Texto para um erro da API: primeiro o erro de campo (se houver), depois o código geral. */
function useErr() {
  const s = useS()
  return (e: unknown): string => {
    if (!(e instanceof ApiError)) return s("err.INTERNAL_ERROR")
    const f = e.fieldErrors[0]
    if (f && f.field === "verification") return s("notice.verifyFirst")
    if (f) return s(`field.${f.code}`)
    return s(`err.${e.code}`)
  }
}

function Load<T>({ q, children }: { q: Loaded<T>; children: (data: T) => ReactNode }) {
  const s = useS()
  const err = useErr()
  if (q.error) {
    return (
      <div className="info-box" role="alert">
        <CircleHelp size={18} /><p>{err(q.error)}</p>
        <button className="text-button" onClick={q.reload}>{s("retry")}</button>
      </div>
    )
  }
  if (!q.data) return <div className="info-box" role="status"><Clock3 size={18} /><p>{s("loading")}</p></div>
  return <>{children(q.data)}</>
}

function makeMoney(language: string, currency: string) {
  const nf = new Intl.NumberFormat(language === "pt" ? "pt-AO" : language, { style: "currency", currency })
  const factor = 10 ** (nf.resolvedOptions().maximumFractionDigits ?? 2)
  return {
    fmt: (minor: number) => nf.format(minor / factor),
    /** Texto digitado (unidades) para menor unidade. Null se inválido. */
    toMinor: (text: string): number | null => {
      const n = Number(text.replace(/\s/g, "").replace(",", "."))
      return Number.isFinite(n) && n > 0 ? Math.round(n * factor) : null
    },
  }
}

function useMoney(currency: string) {
  const { language } = useI18n()
  return useMemo(() => makeMoney(language, currency), [language, currency])
}

function useDate() {
  const { language } = useI18n()
  const f = useMemo(() => new Intl.DateTimeFormat(language, { day: "2-digit", month: "short", year: "numeric" }), [language])
  return (iso: string) => f.format(new Date(iso))
}

const statusClass = (st: string) => (st === "CONFIRMED" || st === "PAID" || st === "ACTIVE" || st === "APPROVED" ? "confirmado" : st === "REJECTED" ? "rejeitado" : "")
const newKey = () => globalThis.crypto.randomUUID()

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page className="form-page">
      <Header title={title} back />
      <div className="form-surface">{children}</div>
    </Page>
  )
}

/** Avisos que impedem operar: serviço desligado ou verificação em falta. */
function Gate({ w }: { w: WalletDto }) {
  const s = useS()
  const navigate = useNavigate()
  if (!w.financeEnabled) return <div className="info-box" role="note"><CircleHelp size={18} /><p>{s("notice.financeOff")}</p></div>
  if (w.requireVerification && w.verificationStatus !== "APPROVED") {
    return (
      <button className="info-box" onClick={() => navigate("/verification")}>
        <Fingerprint size={18} /><p>{s("notice.verifyFirst")}</p><ChevronRight size={16} />
      </button>
    )
  }
  return null
}
const canOperate = (w: WalletDto) => w.financeEnabled && (!w.requireVerification || w.verificationStatus === "APPROVED")

/* ============================== peças partilhadas ============================== */

function BalanceCard({ w }: { w: WalletDto }) {
  const s = useS()
  const m = useMoney(w.currency)
  return (
    <section className="balance-card" aria-label={s("wallet.total")}>
      <span>{s("wallet.total")}</span>
      <h1>{m.fmt(w.total)}</h1>
      <div>
        <span><ArrowDownToLine size={14} /> {s("wallet.available")}<b>{m.fmt(w.available)}</b></span>
        <span><Clock3 size={14} /> {s("wallet.reserved")}<b>{m.fmt(w.reserved)}</b></span>
      </div>
    </section>
  )
}

/** Resumo da conta (estado e email). Vive na carteira, junto ao histórico de transações. */
function AccountSummary() {
  const { t } = useI18n()
  const { user } = useAuth()
  if (!user) return null
  return (
    <>
      <SectionTitle>{t("dash.home.accountTitle")}</SectionTitle>
      <div className="account-grid">
        <div className="stat-card">
          <span><ShieldCheck size={17} /> {t("dash.home.statAccount")}</span>
          <strong>{t(`dashboard.status.${user.status}`)}</strong>
        </div>
        <div className="stat-card">
          <span><Fingerprint size={17} /> {t("dash.home.statEmail")}</span>
          <strong>{user.emailVerified ? t("dashboard.emailVerified") : t("dashboard.emailNotVerified")}</strong>
        </div>
      </div>
    </>
  )
}

function TxRow({ tx, currency, open, onClick }: { tx: TransactionDto; currency: string; open?: boolean; onClick?: () => void }) {
  const s = useS()
  const m = useMoney(currency)
  const d = useDate()
  const Icon = tx.kind === "DEPOSIT" ? ArrowDownToLine : tx.kind === "WITHDRAWAL" ? ArrowUpFromLine : PieChart
  const body = (
    <>
      <span className={`transaction-icon ${tx.kind === "DEPOSIT" ? "in" : "out"}`}><Icon size={16} /></span>
      <div className="transaction-main"><strong>{s(`kind.${tx.kind}`)}</strong><small>{d(tx.createdAt)}</small></div>
      <div className="transaction-meta">
        <b className={tx.kind === "DEPOSIT" ? "positive" : ""}>{tx.kind === "DEPOSIT" ? "+" : "−"}{m.fmt(tx.amountMinor)}</b>
        <span className={`status ${statusClass(tx.status)}`}>{s(`status.${tx.status}`)}</span>
      </div>
    </>
  )
  return onClick ? <button className="transaction" aria-expanded={open} onClick={onClick}>{body}</button> : <div className="transaction">{body}</div>
}

function PlanVisual({ index, large = false }: { index: number; large?: boolean }) {
  const tones = ["", "gold", "violet", "sky"]
  const Icon = [Gem, Layers, Sparkles][index % 3] ?? Gem
  return (
    <div className={`plan-visual ${tones[index % 4] ?? ""} ${large ? "large" : ""}`} aria-hidden="true">
      <span className="visual-orb" />
      <Icon size={large ? 56 : 38} />
    </div>
  )
}

function PlanCard({ plan, index, currency, compact = false }: { plan: PlanDto; index: number; currency: string; compact?: boolean }) {
  const s = useS()
  const m = useMoney(currency)
  const navigate = useNavigate()
  const go = () => navigate(`/plans/${plan.id}`)
  return (
    <div className={`plan-card ${compact ? "compact" : ""}`} role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === "Enter" && go()}>
      <PlanVisual index={index} />
      <div className="plan-info">
        <strong>{plan.name}</strong>
        {plan.termDays !== null && <small>{s("planTerm")}: {s("days", { n: String(plan.termDays) })}</small>}
        {plan.minMinor !== null && <b>{m.fmt(plan.minMinor)}</b>}
        <span>{s(`planStatus.${plan.status}`)}</span>
      </div>
      {!compact && <button className="small-button">{s("details")}</button>}
    </div>
  )
}

/* ============================== início (partes reais) ============================== */

export function HomeLive() {
  const navigate = useNavigate()
  const s = useS()
  const { t } = useI18n()
  const wallet = useLoad(() => platformApi.wallet(), [])
  const plans = useLoad(() => platformApi.plans(), [])
  return (
    <>
      <Load q={wallet}>{(w) => (
        <>
          <BalanceCard w={w} />
          <Gate w={w} />
          <div className="quick-actions">
            <ActionTile icon={ArrowDownToLine} label={t("dash.nav.deposits")} onClick={() => navigate("/deposit")} />
            <ActionTile icon={ArrowUpFromLine} label={t("dash.nav.withdrawals")} onClick={() => navigate("/withdraw")} />
            <ActionTile icon={PieChart} label={t("dash.nav.plans")} onClick={() => navigate("/plans")} />
            <ActionTile icon={FileText} label={t("dash.nav.agreements")} onClick={() => navigate("/agreements")} />
          </div>
          <InviteCard />
          <SectionTitle action={<button className="text-button" onClick={() => navigate("/plans")}>{t("dash.home.seeAll")}</button>}>{t("dash.home.plansTitle")}</SectionTitle>
          <Load q={plans}>{(list) => list.length === 0
            ? <div className="info-box"><CircleHelp size={18} /><p>{s("emptyPlans")}</p></div>
            : <div className="plan-scroll">{list.slice(0, 3).map((p, i) => <PlanCard key={p.id} plan={p} index={i} currency={w.currency} compact />)}</div>}</Load>
        </>
      )}</Load>
    </>
  )
}

/* ============================== carteira ============================== */

export function WalletPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const wallet = useLoad(() => platformApi.wallet(), [])
  const txs = useLoad(() => platformApi.transactions({}), [])
  const s = useS()
  return (
    <Page>
      <Header title={t("dash.nav.wallet")} back />
      <Load q={wallet}>{(w) => (
        <>
          <BalanceCard w={w} />
          <Gate w={w} />
          <div className="quick-actions">
            <ActionTile icon={ArrowDownToLine} label={t("dash.nav.deposits")} onClick={() => navigate("/deposit")} />
            <ActionTile icon={ArrowUpFromLine} label={t("dash.nav.withdrawals")} onClick={() => navigate("/withdraw")} />
            <ActionTile icon={Receipt} label={t("dash.nav.history")} onClick={() => navigate("/history")} />
            <ActionTile icon={PieChart} label={t("dash.nav.plans")} onClick={() => navigate("/plans")} />
          </div>
          <AccountSummary />
          <SectionTitle>{t("dash.nav.history")}</SectionTitle>
          <Load q={txs}>{(r) => r.items.length === 0
            ? <div className="info-box"><CircleHelp size={18} /><p>{s("emptyHistory")}</p></div>
            : <div className="list-card">{r.items.map((x) => <TxRow key={x.id} tx={x} currency={w.currency} />)}</div>}</Load>
        </>
      )}</Load>
    </Page>
  )
}

/* ============================== planos ============================== */

export function PlansPage() {
  const { t } = useI18n()
  const s = useS()
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "COMING_SOON">("ALL")
  const wallet = useLoad(() => platformApi.wallet(), [])
  const plans = useLoad(() => platformApi.plans(), [])
  return (
    <Page>
      <Header title={t("dash.nav.plans")} back />
      <div className="segmented" role="tablist">
        {(["ALL", "OPEN", "COMING_SOON"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{s(`filter.${k}`)}</button>
        ))}
      </div>
      <Load q={wallet}>{(w) => (
        <Load q={plans}>{(list) => {
          const shown = list.filter((p) => filter === "ALL" || p.status === filter)
          return shown.length === 0
            ? <div className="info-box"><CircleHelp size={18} /><p>{s("emptyPlans")}</p></div>
            : <div className="plans-list">{shown.map((p) => <PlanCard key={p.id} plan={p} index={list.indexOf(p)} currency={w.currency} />)}</div>
        }}</Load>
      )}</Load>
    </Page>
  )
}

export function PlanDetailPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const s = useS()
  const err = useErr()
  const wallet = useLoad(() => platformApi.wallet(), [])
  const plan = useLoad(() => platformApi.plan(id), [id])
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const key = useRef(newKey())
  const { language } = useI18n()
  return (
    <Sub title={plan.data?.name ?? s("planTitle")}>
      <Load q={wallet}>{(w) => (
        <Load q={plan}>{(p) => planBody(w, p)}</Load>
      )}</Load>
    </Sub>
  )

  function planBody(w: WalletDto, p: PlanDto) {
    const m = makeMoney(language, w.currency)
    const open = p.status === "OPEN"
    const submit = async () => {
      setError("")
      const minor = m.toMinor(amount)
      if (minor === null) return setError(s("field.invalid"))
      setBusy(true)
      try {
        await platformApi.subscribe(p.id, minor, key.current)
        key.current = newKey()
        setDone(true)
      } catch (e) {
        setError(err(e))
      } finally {
        setBusy(false)
      }
    }
    const fill = p.capacityMinor && p.committedMinor !== null ? Math.min(100, Math.round((p.committedMinor / p.capacityMinor) * 100)) : null
    return (
      <>
        <PlanVisual index={0} large />
        <div className="detail-heading"><div><h1>{p.name}</h1><p>{s(`planStatus.${p.status}`)}</p></div></div>
        {p.description && <p className="body-copy">{p.description}</p>}
        <div className="detail-grid">
          {p.minMinor !== null && <div><span>{s("planMin")}</span><strong>{m.fmt(p.minMinor)}</strong></div>}
          {p.maxMinor !== null && <div><span>{s("planMax")}</span><strong>{m.fmt(p.maxMinor)}</strong></div>}
          {p.termDays !== null && <div><span>{s("planTerm")}</span><strong>{s("days", { n: String(p.termDays) })}</strong></div>}
          {p.riskLabel && <div><span>{s("planRisk")}</span><strong>{p.riskLabel}</strong></div>}
        </div>
        {fill !== null && (
          <div className="investment-card">
            <span>{s("participation")}</span>
            <div className="progress-label"><span>{fill}%</span></div>
            <div className="progress" role="progressbar" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${fill}%` }} /></div>
          </div>
        )}
        <Gate w={w} />
        {done ? (
          <>
            <div className="info-box" role="status"><Check size={18} /><p>{s("subscribed")}</p></div>
            <button className="primary-button" onClick={() => navigate("/history")}>{s("seeHistory")}</button>
          </>
        ) : open && canOperate(w) ? (
          <>
            {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
            <label className="field"><span>{s("amount")}</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
            <p className="body-copy">{s("availableLabel", { amount: m.fmt(w.available) })}</p>
            <button className="primary-button" disabled={busy} onClick={() => void submit()}>{s("subscribe")} <ArrowRight size={16} /></button>
          </>
        ) : null}
      </>
    )
  }
}

/* ============================== depósitos e levantamentos ============================== */

function MoneyFlow({ mode }: { mode: "DEPOSIT" | "WITHDRAWAL" }) {
  const { t } = useI18n()
  const s = useS()
  const err = useErr()
  const navigate = useNavigate()
  const wallet = useLoad(() => platformApi.wallet(), [])
  const methods = useLoad(() => platformApi.methods(mode), [mode])
  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState("")
  const [methodId, setMethodId] = useState("")
  const [destination, setDestination] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ reference: string; instructions: string } | null>(null)
  const key = useRef(newKey())
  const { language } = useI18n()
  const title = t(mode === "DEPOSIT" ? "dash.nav.deposits" : "dash.nav.withdrawals")
  const steps = [s("step.amount"), s(mode === "DEPOSIT" ? "step.method" : "step.destination"), s("step.confirm")]

  return (
    <Sub title={title}>
      <Load q={wallet}>{(w) => (
        <Load q={methods}>{(list) => body(w, list)}</Load>
      )}</Load>
    </Sub>
  )

  function body(w: WalletDto, list: PaymentMethodDto[]) {
    const m = makeMoney(language, w.currency)
    const minor = m.toMinor(amount)
    const method = list.find((x) => x.id === methodId)
    if (!canOperate(w)) return <Gate w={w} />
    if (list.length === 0) return <div className="info-box"><CircleHelp size={18} /><p>{s("emptyMethods")}</p></div>
    if (result) {
      return (
        <>
          <div className="info-box" role="status"><Check size={18} /><p>{s(mode === "DEPOSIT" ? "depositDone" : "withdrawDone")}</p></div>
          <div className="detail-grid">
            <div><span>{s("reference")}</span><strong>{result.reference}</strong></div>
            <div><span>{s("statusLabel")}</span><strong>{s("status.PENDING")}</strong></div>
          </div>
          {result.instructions && <p className="body-copy">{result.instructions}</p>}
          <button className="primary-button" onClick={() => navigate("/history")}>{s("seeHistory")}</button>
        </>
      )
    }
    const next = () => {
      setError("")
      if (step === 1) {
        if (minor === null) return setError(s("field.invalid"))
        if (method?.minMinor != null && minor < method.minMinor) return setError(s("field.belowMinimum"))
        if (mode === "WITHDRAWAL" && minor > w.available) return setError(s("field.insufficientFunds"))
      }
      if (step === 2) {
        if (!method) return setError(s("chooseOne"))
        if (minor !== null && method.minMinor !== null && minor < method.minMinor) return setError(s("field.belowMinimum"))
        if (minor !== null && method.maxMinor !== null && minor > method.maxMinor) return setError(s("field.aboveMaximum"))
        if (mode === "WITHDRAWAL" && destination.trim().length < 4) return setError(s("field.invalid"))
      }
      setStep(step + 1)
    }
    const confirm = async () => {
      if (minor === null || !method) return
      setBusy(true)
      setError("")
      try {
        const r = mode === "DEPOSIT"
          ? await platformApi.createDeposit({ methodId: method.id, amountMinor: minor }, key.current)
          : await platformApi.createWithdrawal({ methodId: method.id, amountMinor: minor, destination: destination.trim() }, key.current)
        key.current = newKey()
        setResult({ reference: r.reference, instructions: "instructions" in r ? r.instructions : "" })
      } catch (e) {
        setError(err(e))
      } finally {
        setBusy(false)
      }
    }
    return (
      <>
        <div className="stepper" aria-label={s("steps")}>
          {steps.map((label, i) => (
            <div key={label} className={step >= i + 1 ? "active" : ""} aria-current={step === i + 1 ? "step" : undefined}><span>{i + 1}</span><small>{label}</small></div>
          ))}
        </div>
        {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
        {step === 1 && (
          <>
            <label className="field"><span>{s("amount")}</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
            {mode === "WITHDRAWAL" && <p className="body-copy">{s("availableLabel", { amount: m.fmt(w.available) })}</p>}
          </>
        )}
        {step === 2 && (
          <>
            <div className="method-list">
              {list.map((x) => (
                <button key={x.id} className={methodId === x.id ? "selected" : ""} aria-pressed={methodId === x.id} onClick={() => setMethodId(x.id)}>
                  <span className="method-icon"><Landmark size={19} /></span>
                  <span>
                    <strong>{x.name}</strong>
                    <small>
                      {[x.minMinor !== null ? `${s("planMin")} ${m.fmt(x.minMinor)}` : "", x.maxMinor !== null ? `${s("planMax")} ${m.fmt(x.maxMinor)}` : "",
                        x.feeMinor !== null ? `${s("fee")} ${m.fmt(x.feeMinor)}` : "", x.feeNote].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  {methodId === x.id ? <Check size={18} /> : <ChevronRight size={18} />}
                </button>
              ))}
            </div>
            {mode === "WITHDRAWAL" && (
              <label className="field" style={{ marginTop: 13 }}><span>{s("account")}</span><input value={destination} onChange={(e) => setDestination(e.target.value)} /></label>
            )}
          </>
        )}
        {step === 3 && minor !== null && method && (
          <div className="detail-grid">
            <div><span>{s("amount")}</span><strong>{m.fmt(minor)}</strong></div>
            <div><span>{s("methodLabel")}</span><strong>{method.name}</strong></div>
            {method.feeMinor !== null && <div><span>{s("fee")}</span><strong>{m.fmt(method.feeMinor)}</strong></div>}
            {mode === "WITHDRAWAL" && <div><span>{s("account")}</span><strong>{destination}</strong></div>}
          </div>
        )}
        <button className="primary-button" disabled={busy} onClick={step === 3 ? () => void confirm() : next}>{step === 3 ? s("confirmRequest") : s("continue")}</button>
        {step > 1 && <button className="secondary-button" onClick={() => { setError(""); setStep(step - 1) }}>{s("back")}</button>}
      </>
    )
  }
}

export function DepositPage() { return <MoneyFlow mode="DEPOSIT" /> }
export function WithdrawPage() { return <MoneyFlow mode="WITHDRAWAL" /> }

/* ============================== histórico ============================== */

export function HistoryPage() {
  const { t } = useI18n()
  const s = useS()
  const err = useErr()
  const wallet = useLoad(() => platformApi.wallet(), [])
  const [kind, setKind] = useState("")
  const [q, setQ] = useState("")
  const [items, setItems] = useState<TransactionDto[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  const [open, setOpen] = useState("")

  const fetchPage = useCallback(async (after: string | null) => {
    setState("loading")
    try {
      const r = await platformApi.transactions({ ...(kind ? { kind } : {}), ...(q ? { q } : {}), ...(after ? { cursor: after } : {}) })
      setItems((prev) => (after ? [...prev, ...r.items] : r.items))
      setCursor(r.nextCursor)
      setState("ready")
    } catch (e) {
      setError(err(e))
      setState("error")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, q])
  useEffect(() => { const h = setTimeout(() => void fetchPage(null), 250); return () => clearTimeout(h) }, [fetchPage])

  const cancel = async (tx: TransactionDto) => {
    try {
      await platformApi.cancel(tx.kind, tx.id)
      await fetchPage(null)
    } catch (e) {
      setError(err(e))
      setState("error")
    }
  }
  return (
    <Page>
      <Header title={t("dash.nav.history")} back />
      <label className="search-field"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s("search")} aria-label={s("search")} /></label>
      <div className="segmented" role="tablist">
        {["", "DEPOSIT", "WITHDRAWAL", "SUBSCRIPTION"].map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "active" : ""} onClick={() => setKind(k)}>{k ? s(`kindShort.${k}`) : s("tab.all")}</button>
        ))}
      </div>
      {state === "error" && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
      <Load q={wallet}>{(w) => (
        <>
          <div className="list-card">
            {state === "ready" && items.length === 0 && <div className="transaction"><div className="transaction-main"><small>{s("emptyHistory")}</small></div></div>}
            {items.map((x) => (
              <div key={x.id}>
                <TxRow tx={x} currency={w.currency} open={open === x.id} onClick={() => setOpen(open === x.id ? "" : x.id)} />
                {open === x.id && (
                  <div className="detail-grid">
                    <div><span>{s("reference")}</span><strong>{x.reference}</strong></div>
                    <div><span>{s("statusLabel")}</span><strong>{s(`status.${x.status}`)}</strong></div>
                    {x.status === "PENDING" && <button className="secondary-button" onClick={() => void cancel(x)}>{s("cancelRequest")}</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {cursor && <button className="secondary-button" disabled={state === "loading"} onClick={() => void fetchPage(cursor)}>{s("loadMore")}</button>}
        </>
      )}</Load>
    </Page>
  )
}

/* ============================== acordos ============================== */

export function AgreementsPage() {
  const { t } = useI18n()
  const s = useS()
  const err = useErr()
  const d = useDate()
  const q = useLoad(() => platformApi.agreements(), [])
  const [list, setList] = useState<Awaited<ReturnType<typeof platformApi.agreements>> | null>(null)
  const [open, setOpen] = useState("")
  const [check, setCheck] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { if (q.data) setList(q.data) }, [q.data])
  const accept = async (versionId: string) => {
    setError("")
    try { setList(await platformApi.acceptAgreement(versionId)) } catch (e) { setError(err(e)) }
  }
  return (
    <Sub title={t("dash.nav.agreements")}>
      {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
      <Load q={{ ...q, data: list }}>{(items) => items.length === 0
        ? <div className="info-box"><CircleHelp size={18} /><p>{s("emptyAgreements")}</p></div>
        : (
          <div className="method-list">
            {items.map((a) => (
              <div key={a.versionId}>
                <button aria-expanded={open === a.versionId} onClick={() => { setOpen(open === a.versionId ? "" : a.versionId); setCheck(false) }}>
                  <span className="method-icon"><FileText size={19} /></span>
                  <span><strong>{a.title}</strong><small>{s("version", { v: String(a.version) })} · {a.acceptedAt ? `${s("accepted")} ${d(a.acceptedAt)}` : s("toAccept")}</small></span>
                  <ChevronDown size={18} />
                </button>
                {open === a.versionId && (
                  <div className="form-surface" style={{ minHeight: 0, borderRadius: 0 }}>
                    <p className="body-copy" style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>
                    {a.acceptedAt ? <span className="status confirmado">{s("accepted")}</span> : (
                      <>
                        <label className="check-row"><input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} /><span>{s("acceptCheck")}</span></label>
                        <button className="primary-button" disabled={!check} onClick={() => void accept(a.versionId)}>{s("acceptButton")}</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}</Load>
    </Sub>
  )
}

/* ============================== verificação de identidade ============================== */

const MAX_FILE = 1_500_000
const readB64 = (f: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "")
    r.onerror = () => reject(new Error("read"))
    r.readAsDataURL(f)
  })

export function VerificationPage() {
  const { t } = useI18n()
  const s = useS()
  const err = useErr()
  const q = useLoad(() => platformApi.verification(), [])
  const [docType, setDocType] = useState<VerificationDocType | "">("")
  const [country, setCountry] = useState("AO")
  const [files, setFiles] = useState<Partial<Record<VerificationFileKind, File>>>({})
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const pick = (k: VerificationFileKind) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f && f.size > MAX_FILE) return setError(s("field.fileSize"))
    setError("")
    setFiles((p) => ({ ...p, ...(f ? { [k]: f } : {}) }))
  }
  const row = (k: VerificationFileKind) => (
    <div className="upload-row" key={k}>
      <Upload size={18} /><span>{files[k]?.name ?? s(`upload.${k}`)}</span>
      <label>{s("chooseFile")}<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={pick(k)} /></label>
    </div>
  )
  const submit = async () => {
    const front = files.FRONT, selfie = files.SELFIE
    if (!docType || !front || !selfie) return setError(s("field.required"))
    setBusy(true)
    setError("")
    try {
      const all = (["FRONT", "BACK", "SELFIE"] as const).flatMap((k) => (files[k] ? [{ kind: k, file: files[k] as File }] : []))
      const payload = await Promise.all(all.map(async ({ kind, file }) => ({ kind, mime: file.type, dataBase64: await readB64(file) })))
      await platformApi.submitVerification({ docType, issuingCountry: country, files: payload })
      q.reload()
    } catch (e) {
      setError(err(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sub title={t("dash.nav.verification")}>
      <Load q={q}>{(sub) => {
        if (sub && (sub.status === "PENDING" || sub.status === "APPROVED")) {
          return (
            <>
              <div className="info-box" role="status"><Check size={18} /><p>{s(sub.status === "PENDING" ? "verifyPending" : "verifyApproved")}</p></div>
              <div className="detail-grid"><div><span>{s("statusLabel")}</span><strong>{s(`vstatus.${sub.status}`)}</strong></div></div>
            </>
          )
        }
        return (
          <>
            {sub?.status === "REJECTED" && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{s("verifyRejected")}{sub.rejectionReason ? `: ${sub.rejectionReason}` : ""}</p></div>}
            {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
            <label className="field">
              <span>{s("issuingCountry")}</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="AO">Angola</option><option value="PT">Portugal</option><option value="BR">Brasil</option><option value="MZ">Moçambique</option><option value="CV">Cabo Verde</option>
              </select>
            </label>
            <div className="method-list">
              {(["ID_CARD", "PASSPORT", "RESIDENCE_PERMIT"] as const).map((k) => (
                <button key={k} className={docType === k ? "selected" : ""} aria-pressed={docType === k} onClick={() => setDocType(k)}>
                  <span className="method-icon"><Fingerprint size={19} /></span><span><strong>{s(`doc.${k}`)}</strong></span>
                  {docType === k ? <Check size={18} /> : <ChevronRight size={18} />}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 13 }}>{row("FRONT")}{row("BACK")}{row("SELFIE")}</div>
            <p className="body-copy">{s("fileRules")}</p>
            <button className="primary-button" disabled={busy} onClick={() => void submit()}>{s("submitReview")}</button>
          </>
        )
      }}</Load>
    </Sub>
  )
}

/* ============================== notificações ============================== */

export function NotificationsPage() {
  const { t } = useI18n()
  const s = useS()
  const d = useDate()
  const { language } = useI18n()
  const wallet = useLoad(() => platformApi.wallet(), [])
  const q = useLoad(() => platformApi.notifications(), [])
  const [tab, setTab] = useState<"all" | "unread">("all")
  const mark = async (id: string) => { await platformApi.readNotification(id).catch(() => undefined); q.reload() }
  const markAll = async () => { await platformApi.readAllNotifications().catch(() => undefined); q.reload() }
  return (
    <Page>
      <Header title={t("dash.nav.notifications")} back />
      <SectionTitle action={<button className="text-button" onClick={() => void markAll()}>{s("markAll")}</button>}>{t("dash.nav.notifications")}</SectionTitle>
      <div className="segmented" role="tablist">
        {(["all", "unread"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{s(`tab.${k}`)}</button>
        ))}
      </div>
      <Load q={wallet}>{(w) => notices(w)}</Load>
    </Page>
  )

  function notices(w: WalletDto) {
    const money = makeMoney(language, w.currency)
    return (
      <Load q={q}>{(r) => {
        const list = r.items.filter((n) => tab === "all" || !n.read)
        return (
          <div className="notice-list">
            {list.length === 0 && <p className="body-copy">{s("noNotifications")}</p>}
            {list.map((n) => {
              const Icon = n.type.startsWith("DEPOSIT") ? ArrowDownToLine : n.type.startsWith("WITHDRAWAL") ? ArrowUpFromLine : n.type.startsWith("VERIFICATION") ? ShieldCheck : n.type.startsWith("SUPPORT") ? WalletCards : Bell
              const params = { reference: String(n.params["reference"] ?? ""), amount: typeof n.params["amountMinor"] === "number" ? money.fmt(n.params["amountMinor"]) : "" }
              return (
                <button key={n.id} className={`notice ${n.read ? "" : "unread"}`} onClick={() => void mark(n.id)}>
                  <span className={`notice-icon ${n.type.endsWith("REJECTED") ? "red" : n.type.endsWith("PAID") || n.type.endsWith("CONFIRMED") || n.type.endsWith("APPROVED") ? "green" : "blue"}`}><Icon size={16} /></span>
                  <div><strong>{s(`notif.${n.type}.title`)}</strong><p>{s(`notif.${n.type}.body`, params)}</p></div>
                  <small>{d(n.createdAt)}</small>
                </button>
              )
            })}
          </div>
        )
      }}</Load>
    )
  }
}

/* ============================== suporte ============================== */

export function SupportPage() {
  const { t } = useI18n()
  const s = useS()
  const err = useErr()
  const d = useDate()
  const q = useLoad(() => platformApi.tickets(), [])
  const [search, setSearch] = useState("")
  const [faqOpen, setFaqOpen] = useState("")
  const [category, setCategory] = useState("ACCOUNT")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [open, setOpen] = useState("")
  const [reply, setReply] = useState("")
  const detail = useLoad(() => (open ? platformApi.ticket(open) : Promise.resolve(null)), [open])
  const faq = ["q1", "q2", "q3", "q4"].filter((k) => !search || `${s(`faq.${k}.q`)} ${s(`faq.${k}.a`)}`.toLowerCase().includes(search.toLowerCase()))
  const create = async () => {
    setError("")
    try { await platformApi.createTicket({ subject, category, message }); setSubject(""); setMessage(""); q.reload() } catch (e) { setError(err(e)) }
  }
  const send = async () => {
    setError("")
    try { await platformApi.reply(open, reply); setReply(""); detail.reload(); q.reload() } catch (e) { setError(err(e)) }
  }
  return (
    <Sub title={t("dash.nav.support")}>
      <label className="search-field"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={s("search")} aria-label={s("search")} /></label>
      <h2>{s("faqTitle")}</h2>
      <div className="faq-list">
        {faq.map((k) => (
          <button key={k} aria-expanded={faqOpen === k} onClick={() => setFaqOpen(faqOpen === k ? "" : k)}>
            <span>{s(`faq.${k}.q`)}<small hidden={faqOpen !== k}>{s(`faq.${k}.a`)}</small></span><ChevronDown size={16} />
          </button>
        ))}
      </div>
      {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
      <h2>{s("newTicket")}</h2>
      <label className="field"><span>{s("subject")}</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} /></label>
      <label className="field">
        <span>{s("category")}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {["ACCOUNT", "DEPOSIT", "WITHDRAWAL", "VERIFICATION", "OTHER"].map((k) => <option key={k} value={k}>{s(`subjects.${k}`)}</option>)}
        </select>
      </label>
      <label className="field"><span>{s("message")}</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} /></label>
      <button className="primary-button" disabled={subject.trim().length < 3 || message.trim().length < 1} onClick={() => void create()}>{s("send")}</button>
      <h2>{s("myTickets")}</h2>
      <Load q={q}>{(list) => (
        <div className="list-card">
          {list.length === 0 && <div className="transaction"><div className="transaction-main"><small>{s("noTickets")}</small></div></div>}
          {list.map((k) => (
            <div key={k.id}>
              <button className="transaction" aria-expanded={open === k.id} onClick={() => setOpen(open === k.id ? "" : k.id)}>
                <span className="transaction-icon"><WalletCards size={16} /></span>
                <div className="transaction-main"><strong>{k.subject}</strong><small>{d(k.updatedAt)}</small></div>
                <div className="transaction-meta"><span className="status">{s(`ticket.${k.status}`)}</span></div>
              </button>
              {open === k.id && detail.data && (
                <div className="stack" style={{ padding: 12 }}>
                  {detail.data.messages.map((x) => <p key={x.id} className="body-copy"><strong>{x.staff ? s("staff") : s("you")}:</strong> {x.body}</p>)}
                  {k.status !== "CLOSED" && (
                    <>
                      <label className="field"><span>{s("message")}</span><textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} /></label>
                      <button className="primary-button" disabled={!reply.trim()} onClick={() => void send()}>{s("send")}</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}</Load>
    </Sub>
  )
}
