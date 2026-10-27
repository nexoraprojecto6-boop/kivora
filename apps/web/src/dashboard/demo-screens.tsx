import { useState, type ChangeEvent, type ReactNode } from "react"
import {
  ArrowDownToLine, ArrowRight, ArrowUpFromLine, Bell, Check, ChevronDown, ChevronRight, CircleHelp,
  Clock3, FileText, Fingerprint, Gem, Landmark, Layers, PieChart, Receipt, Search, ShieldCheck,
  Smartphone, Sparkles, Upload, WalletCards,
} from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { useI18n } from "../i18n/I18nProvider.js"
import { ActionTile, Header, Page, SectionTitle } from "./App.js"
import { ACCOUNT, AGREEMENTS, NOTIFICATIONS, PLANS, TRANSACTIONS, WEEK, type Plan, type Tx } from "./demo.js"

/* ------------------------------------------------------------ utilitários */

function useFmt() {
  const { language } = useI18n()
  const money = new Intl.NumberFormat(language === "pt" ? "pt-AO" : language, {
    style: "currency", currency: "AOA", maximumFractionDigits: 0,
  })
  const date = new Intl.DateTimeFormat(language, { day: "2-digit", month: "short", year: "numeric" })
  return { money: (n: number) => money.format(n), date: (iso: string) => date.format(new Date(iso)) }
}

function useS() {
  const { t } = useI18n()
  return (key: string, params?: Record<string, string>) => t(`dash.s.${key}`, params)
}

function DemoBanner() {
  const s = useS()
  return (
    <div className="info-box" role="note">
      <CircleHelp size={18} />
      <p>{s("banner")}</p>
    </div>
  )
}

/** Mensagem curta para ações simuladas (nada é enviado ao servidor). */
function useFlash(): [ReactNode, (msg?: string) => void] {
  const s = useS()
  const [msg, setMsg] = useState("")
  const node = msg ? (
    <div className="info-box demo-flash" role="status">
      <Check size={18} />
      <p>{msg}</p>
    </div>
  ) : null
  return [node, (m) => setMsg(m ?? s("actionDone"))]
}

const statusClass = (st: Tx["status"]) => (st === "confirmed" ? "confirmado" : st === "rejected" ? "rejeitado" : "")
const isIn = (k: Tx["kind"]) => k === "deposit" || k === "refund"

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page className="form-page">
      <Header title={title} back />
      <div className="form-surface">
        <DemoBanner />
        {children}
      </div>
    </Page>
  )
}

function TxRow({ tx, open, onClick }: { tx: Tx; open?: boolean; onClick?: () => void }) {
  const s = useS()
  const f = useFmt()
  const Icon = tx.kind === "deposit" ? ArrowDownToLine : tx.kind === "withdraw" ? ArrowUpFromLine : tx.kind === "refund" ? Receipt : PieChart
  const body = (
    <>
      <span className={`transaction-icon ${isIn(tx.kind) ? "in" : "out"}`}><Icon size={16} /></span>
      <div className="transaction-main">
        <strong>{s(`kind.${tx.kind}`)}</strong>
        <small>{f.date(tx.date)}</small>
      </div>
      <div className="transaction-meta">
        <b className={isIn(tx.kind) ? "positive" : ""}>{isIn(tx.kind) ? "+" : "−"}{f.money(tx.amount)}</b>
        <span className={`status ${statusClass(tx.status)}`}>{s(`status.${tx.status}`)}</span>
      </div>
    </>
  )
  return onClick ? (
    <>
      <button className="transaction" aria-expanded={open} onClick={onClick}>{body}</button>
      {open && (
        <div className="detail-grid">
          <div><span>{s("reference")}</span><strong>{tx.ref}</strong></div>
          <div><span>{s("statusLabel")}</span><strong>{s(`status.${tx.status}`)}</strong></div>
        </div>
      )}
    </>
  ) : (
    <div className="transaction">{body}</div>
  )
}

function PlanVisual({ plan, large = false }: { plan: Plan; large?: boolean }) {
  const Icon = plan.icon === "gem" ? Gem : plan.icon === "layers" ? Layers : Sparkles
  return (
    <div className={`plan-visual ${plan.tone} ${large ? "large" : ""}`} aria-hidden="true">
      <span className="visual-orb" />
      <Icon size={large ? 56 : 38} />
    </div>
  )
}

function PlanCard({ plan, compact = false }: { plan: Plan; compact?: boolean }) {
  const s = useS()
  const f = useFmt()
  const navigate = useNavigate()
  return (
    <div className={`plan-card ${compact ? "compact" : ""}`} role="link" tabIndex={0}
      onClick={() => navigate(`/plans/${plan.id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/plans/${plan.id}`)}>
      <PlanVisual plan={plan} />
      <div className="plan-info">
        <strong>{plan.name}</strong>
        <small>{s("planTerm")}: {s("months", { n: String(plan.months) })}</small>
        <b>{f.money(plan.min)}</b>
        <span>{plan.open ? s("open") : s("soon")}</span>
      </div>
      {!compact && <button className="small-button">{s("details")}</button>}
    </div>
  )
}

/* ------------------------------------------------------------------- Início */

export function HomeDemo() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const s = useS()
  const f = useFmt()
  return (
    <Page>
      <Header />
      <DemoBanner />
      <section className="balance-card" aria-label={s("balanceTitle")}>
        <span>{s("balanceTitle")}</span>
        <h1>{f.money(ACCOUNT.total)}</h1>
        <div>
          <span><ArrowDownToLine size={14} /> {s("available")}<b>{f.money(ACCOUNT.available)}</b></span>
          <span><Clock3 size={14} /> {s("reserved")}<b>{f.money(ACCOUNT.reserved)}</b></span>
        </div>
      </section>
      <div className="quick-actions">
        <ActionTile icon={ArrowDownToLine} label={t("dash.nav.deposits")} onClick={() => navigate("/deposit")} />
        <ActionTile icon={ArrowUpFromLine} label={t("dash.nav.withdrawals")} onClick={() => navigate("/withdraw")} />
        <ActionTile icon={PieChart} label={t("dash.nav.plans")} onClick={() => navigate("/plans")} />
        <ActionTile icon={FileText} label={t("dash.nav.agreements")} onClick={() => navigate("/agreements")} />
      </div>
      <button className="info-box" onClick={() => navigate("/verification")}>
        <Fingerprint size={18} />
        <p><strong>{s("verifyTitle")}</strong><br />{s("verifyText")}</p>
        <ChevronRight size={16} />
      </button>
      <SectionTitle action={<button className="text-button" onClick={() => navigate("/plans")}>{t("dash.home.seeAll")}</button>}>
        {t("dash.home.plansTitle")}
      </SectionTitle>
      <div className="plan-scroll">{PLANS.map((p) => <PlanCard key={p.id} plan={p} compact />)}</div>
      <SectionTitle action={<button className="text-button" onClick={() => navigate("/history")}>{t("dash.home.seeAllRecent")}</button>}>
        {t("dash.home.recentTitle")}
      </SectionTitle>
      <div className="list-card">{TRANSACTIONS.slice(0, 4).map((tx) => <TxRow key={tx.id} tx={tx} />)}</div>
    </Page>
  )
}

/* ----------------------------------------------------------------- Carteira */

export function WalletPage() {
  const { t } = useI18n()
  const s = useS()
  const f = useFmt()
  const navigate = useNavigate()
  const [tab, setTab] = useState<"all" | "in" | "out">("all")
  const max = Math.max(...WEEK)
  const pts = WEEK.map((v, i) => `${(i * 300) / (WEEK.length - 1)},${110 - (v / max) * 95}`)
  const rows = TRANSACTIONS.filter((x) => tab === "all" || (tab === "in") === isIn(x.kind)).slice(0, 6)
  return (
    <Page>
      <Header title={t("dash.nav.wallet")} back />
      <DemoBanner />
      <section className="balance-card">
        <span>{s("balanceTitle")}</span>
        <h1>{f.money(ACCOUNT.total)}</h1>
        <div>
          <span><ArrowDownToLine size={14} /> {s("available")}<b>{f.money(ACCOUNT.available)}</b></span>
          <span><Clock3 size={14} /> {s("reserved")}<b>{f.money(ACCOUNT.reserved)}</b></span>
        </div>
      </section>
      <div className="quick-actions">
        <ActionTile icon={ArrowDownToLine} label={t("dash.nav.deposits")} onClick={() => navigate("/deposit")} />
        <ActionTile icon={ArrowUpFromLine} label={t("dash.nav.withdrawals")} onClick={() => navigate("/withdraw")} />
        <ActionTile icon={Receipt} label={t("dash.nav.history")} onClick={() => navigate("/history")} />
        <ActionTile icon={PieChart} label={t("dash.nav.plans")} onClick={() => navigate("/plans")} />
      </div>
      <div className="chart-card">
        <div className="chart-head"><strong>{s("chartTitle")}</strong><span>{s("chartNote")}</span></div>
        <svg className="chart" viewBox="0 0 300 120" role="img" aria-label={s("chartTitle")}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#175bff" stopOpacity=".25" />
              <stop offset="1" stopColor="#175bff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon className="chart-fill" points={`0,120 ${pts.join(" ")} 300,120`} />
          <polyline className="chart-line" points={pts.join(" ")} />
        </svg>
      </div>
      <SectionTitle>{t("dash.nav.history")}</SectionTitle>
      <div className="segmented" role="tablist">
        {(["all", "in", "out"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {s(`tab.${k}`)}
          </button>
        ))}
      </div>
      <div className="list-card">{rows.map((tx) => <TxRow key={tx.id} tx={tx} />)}</div>
    </Page>
  )
}

/* ------------------------------------------------------------------- Planos */

export function PlansPage() {
  const { t } = useI18n()
  const s = useS()
  const [filter, setFilter] = useState<"all" | "open" | "soon">("all")
  const list = PLANS.filter((p) => filter === "all" || (filter === "open") === p.open)
  return (
    <Page>
      <Header title={t("dash.nav.plans")} back />
      <DemoBanner />
      <div className="segmented" role="tablist">
        {(["all", "open", "soon"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>
            {s(`filter.${k}`)}
          </button>
        ))}
      </div>
      <div className="plans-list">{list.map((p) => <PlanCard key={p.id} plan={p} />)}</div>
    </Page>
  )
}

export function PlanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const s = useS()
  const f = useFmt()
  const plan = PLANS.find((p) => p.id === id)
  const [flash, show] = useFlash()
  if (!plan) return <Sub title={s("planTitle")}><p className="body-copy">{s("notFound")}</p></Sub>
  return (
    <Sub title={`${s("planTitle")} ${plan.name}`}>
      {flash}
      <PlanVisual plan={plan} large />
      <div className="detail-heading">
        <div><h1>{plan.name}</h1><p>{plan.open ? s("open") : s("soon")}</p></div>
      </div>
      <p className="body-copy">{s("planText")}</p>
      <div className="detail-grid">
        <div><span>{s("planMin")}</span><strong>{f.money(plan.min)}</strong></div>
        <div><span>{s("planTerm")}</span><strong>{s("months", { n: String(plan.months) })}</strong></div>
        <div><span>{s("planRisk")}</span><strong>{s(`risk.${plan.risk}`)}</strong></div>
        <div><span>{s("planState")}</span><strong>{plan.open ? s("open") : s("soon")}</strong></div>
      </div>
      <div className="investment-card">
        <span>{s("participation")}</span>
        <div className="progress-label"><span>{plan.fill}%</span></div>
        <div className="progress" role="progressbar" aria-valuenow={plan.fill} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${plan.fill}%` }} />
        </div>
      </div>
      <button className="primary-button" disabled={!plan.open} onClick={() => navigate("/agreements")}>
        {s("subscribe")} <ArrowRight size={16} />
      </button>
      <button className="secondary-button" onClick={() => show()}>{s("reminder")}</button>
    </Sub>
  )
}

/* ------------------------------------------- Depósitos e levantamentos */

function MoneyFlow({ mode }: { mode: "deposit" | "withdraw" }) {
  const { t } = useI18n()
  const s = useS()
  const f = useFmt()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("")
  const [account, setAccount] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const value = Number(amount.replace(",", "."))
  const all: ReadonlyArray<readonly [string, typeof Landmark]> = [["bank", Landmark], ["express", Smartphone], ["ref", Receipt]]
  const methods = mode === "deposit" ? all : all.slice(0, 2)
  const steps = [s("step.amount"), s(mode === "deposit" ? "step.method" : "step.destination"), s("step.confirm")]
  const title = t(mode === "deposit" ? "dash.nav.deposits" : "dash.nav.withdrawals")

  const next = () => {
    setError("")
    if (step === 1) {
      if (!Number.isFinite(value) || value <= 0) return setError(s("invalidAmount"))
      if (mode === "withdraw" && value > ACCOUNT.available) return setError(s("exceeds"))
    }
    if (step === 2 && !method) return setError(s("chooseOne"))
    if (step === 2 && mode === "withdraw" && account.trim().length < 6) return setError(s("invalidAccount"))
    setStep((n) => n + 1)
  }

  if (done) {
    return (
      <Sub title={title}>
        <div className="info-box" role="status"><Check size={18} /><p>{s(mode === "deposit" ? "depositDone" : "withdrawDone")}</p></div>
        <button className="primary-button" onClick={() => navigate("/history")}>{s("seeHistory")}</button>
        <button className="secondary-button" onClick={() => { setDone(false); setStep(1); setAmount(""); setMethod(""); setAccount("") }}>
          {s("newRequest")}
        </button>
      </Sub>
    )
  }
  return (
    <Sub title={title}>
      <div className="stepper" aria-label={s("steps")}>
        {steps.map((label, i) => (
          <div key={label} className={step >= i + 1 ? "active" : ""} aria-current={step === i + 1 ? "step" : undefined}>
            <span>{i + 1}</span><small>{label}</small>
          </div>
        ))}
      </div>
      {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
      {step === 1 && (
        <>
          <label className="field">
            <span>{s("amount")}</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </label>
          {mode === "withdraw" && <p className="body-copy">{s("availableLabel", { amount: f.money(ACCOUNT.available) })}</p>}
        </>
      )}
      {step === 2 && (
        <>
          <div className="method-list">
            {methods.map(([key, Icon]) => (
              <button key={key} className={method === key ? "selected" : ""} aria-pressed={method === key} onClick={() => setMethod(key)}>
                <span className="method-icon"><Icon size={19} /></span>
                <span><strong>{s(`method.${key}`)}</strong><small>{s("methodNote")}</small></span>
                {method === key ? <Check size={18} /> : <ChevronRight size={18} />}
              </button>
            ))}
          </div>
          {mode === "withdraw" && (
            <label className="field" style={{ marginTop: 13 }}>
              <span>{s("account")}</span>
              <input value={account} onChange={(e) => setAccount(e.target.value)} />
            </label>
          )}
        </>
      )}
      {step === 3 && (
        <div className="detail-grid">
          <div><span>{s("amount")}</span><strong>{f.money(value)}</strong></div>
          <div><span>{s("methodLabel")}</span><strong>{s(`method.${method || "bank"}`)}</strong></div>
          <div><span>{s("fee")}</span><strong>{s("tbd")}</strong></div>
          <div><span>{s("statusLabel")}</span><strong>{s("status.pending")}</strong></div>
        </div>
      )}
      <button className="primary-button" onClick={step === 3 ? () => setDone(true) : next}>
        {step === 3 ? s("confirmRequest") : s("continue")}
      </button>
      {step > 1 && <button className="secondary-button" onClick={() => { setError(""); setStep((n) => n - 1) }}>{s("back")}</button>}
    </Sub>
  )
}

export function DepositPage() {
  return <MoneyFlow mode="deposit" />
}
export function WithdrawPage() {
  return <MoneyFlow mode="withdraw" />
}

/* ---------------------------------------------------------------- Histórico */

export function HistoryPage() {
  const { t } = useI18n()
  const s = useS()
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<"all" | Tx["kind"]>("all")
  const [limit, setLimit] = useState(5)
  const [open, setOpen] = useState("")
  const rows = TRANSACTIONS.filter((x) => (kind === "all" || x.kind === kind) &&
    (!q || x.ref.toLowerCase().includes(q.toLowerCase()) || s(`kind.${x.kind}`).toLowerCase().includes(q.toLowerCase())))
  return (
    <Page>
      <Header title={t("dash.nav.history")} back />
      <DemoBanner />
      <label className="search-field">
        <Search size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s("search")} aria-label={s("search")} />
      </label>
      <div className="segmented" role="tablist">
        {(["all", "deposit", "withdraw", "plan"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "active" : ""} onClick={() => { setKind(k); setLimit(5) }}>
            {k === "all" ? s("tab.all") : s(`kindShort.${k}`)}
          </button>
        ))}
      </div>
      <div className="list-card">
        {rows.length === 0 && <div className="transaction"><div className="transaction-main"><small>{s("noResults")}</small></div></div>}
        {rows.slice(0, limit).map((tx) => (
          <TxRow key={tx.id} tx={tx} open={open === tx.id} onClick={() => setOpen(open === tx.id ? "" : tx.id)} />
        ))}
      </div>
      {rows.length > limit && <button className="secondary-button" onClick={() => setLimit((n) => n + 5)}>{s("loadMore")}</button>}
    </Page>
  )
}

/* ------------------------------------------------------------------- Acordos */

export function AgreementsPage() {
  const { t } = useI18n()
  const s = useS()
  const [accepted, setAccepted] = useState<Record<string, boolean>>(() => Object.fromEntries(AGREEMENTS.map((a) => [a.id, a.accepted])))
  const [open, setOpen] = useState("")
  const [check, setCheck] = useState(false)
  return (
    <Page className="form-page">
      <Header title={t("dash.nav.agreements")} back />
      <div className="form-surface">
        <DemoBanner />
        <div className="method-list">
          {AGREEMENTS.map((a) => {
            const isOpen = open === a.id
            return (
              <div key={a.id}>
                <button aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? "" : a.id); setCheck(false) }}>
                  <span className="method-icon"><FileText size={19} /></span>
                  <span>
                    <strong>{s(`agreement.${a.id}`)}</strong>
                    <small>{s("version", { v: a.version })} · {accepted[a.id] ? s("accepted") : s("toAccept")}</small>
                  </span>
                  <ChevronDown size={18} />
                </button>
                {isOpen && (
                  <div className="form-surface" style={{ minHeight: 0, borderRadius: 0 }}>
                    <p className="body-copy">{s("agreementText")}</p>
                    {accepted[a.id] ? (
                      <span className="status confirmado">{s("accepted")}</span>
                    ) : (
                      <>
                        <label className="check-row">
                          <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} />
                          <span>{s("acceptCheck")}</span>
                        </label>
                        <button className="primary-button" disabled={!check} onClick={() => setAccepted({ ...accepted, [a.id]: true })}>
                          {s("acceptButton")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Page>
  )
}

/* ------------------------------------------------------------- Verificação */

export function VerificationPage() {
  const { t } = useI18n()
  const s = useS()
  const [step, setStep] = useState(1)
  const [docType, setDocType] = useState("")
  const [country, setCountry] = useState("AO")
  const [files, setFiles] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  const pick = (key: string) => (e: ChangeEvent<HTMLInputElement>) =>
    setFiles({ ...files, [key]: e.target.files?.[0]?.name ?? "" })
  const uploadRow = (k: string) => (
    <div className="upload-row" key={k}>
      <Upload size={18} />
      <span>{files[k] || s(`upload.${k}`)}</span>
      <label>{s("chooseFile")}<input type="file" accept="image/*,.pdf" onChange={pick(k)} /></label>
    </div>
  )
  const title = t("dash.nav.verification")
  if (sent) {
    return (
      <Sub title={title}>
        <div className="info-box" role="status"><Check size={18} /><p>{s("verifyDone")}</p></div>
        <div className="detail-grid"><div><span>{s("statusLabel")}</span><strong>{s("status.review")}</strong></div></div>
      </Sub>
    )
  }
  return (
    <Sub title={title}>
      <div className="stepper">
        {[s("step.document"), s("step.selfie"), s("step.confirm")].map((label, i) => (
          <div key={label} className={step >= i + 1 ? "active" : ""}><span>{i + 1}</span><small>{label}</small></div>
        ))}
      </div>
      {step === 1 && (
        <>
          <label className="field">
            <span>{s("issuingCountry")}</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="AO">Angola</option><option value="PT">Portugal</option><option value="BR">Brasil</option><option value="OTHER">{s("other")}</option>
            </select>
          </label>
          <div className="method-list">
            {(["id", "passport", "residence"] as const).map((k) => (
              <button key={k} className={docType === k ? "selected" : ""} aria-pressed={docType === k} onClick={() => setDocType(k)}>
                <span className="method-icon"><Fingerprint size={19} /></span>
                <span><strong>{s(`doc.${k}`)}</strong></span>
                {docType === k ? <Check size={18} /> : <ChevronRight size={18} />}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 13 }}>{uploadRow("front")}{uploadRow("back")}</div>
        </>
      )}
      {step === 2 && <><p className="body-copy">{s("selfieText")}</p>{uploadRow("selfie")}</>}
      {step === 3 && (
        <div className="detail-grid">
          <div><span>{s("issuingCountry")}</span><strong>{country}</strong></div>
          <div><span>{s("docType")}</span><strong>{docType ? s(`doc.${docType}`) : "—"}</strong></div>
        </div>
      )}
      <button className="primary-button" disabled={step === 1 && !docType} onClick={step === 3 ? () => setSent(true) : () => setStep(step + 1)}>
        {step === 3 ? s("submitReview") : s("continue")}
      </button>
      {step > 1 && <button className="secondary-button" onClick={() => setStep(step - 1)}>{s("back")}</button>}
    </Sub>
  )
}

/* ------------------------------------------------------------ Notificações */

export function NotificationsPage() {
  const { t } = useI18n()
  const s = useS()
  const f = useFmt()
  const [read, setRead] = useState<Record<string, boolean>>(() => Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, n.read])))
  const [tab, setTab] = useState<"all" | "unread">("all")
  const icons = { in: ArrowDownToLine, out: ArrowUpFromLine, doc: FileText, shield: ShieldCheck }
  const list = NOTIFICATIONS.filter((n) => tab === "all" || !read[n.id])
  return (
    <Page>
      <Header title={t("dash.nav.notifications")} back />
      <DemoBanner />
      <SectionTitle action={<button className="text-button" onClick={() => setRead(Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, true])))}>{s("markAll")}</button>}>
        {t("dash.nav.notifications")}
      </SectionTitle>
      <div className="segmented" role="tablist">
        {(["all", "unread"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{s(`tab.${k}`)}</button>
        ))}
      </div>
      <div className="notice-list">
        {list.length === 0 && <p className="body-copy">{s("noNotifications")}</p>}
        {list.map((n) => {
          const Icon = icons[n.icon] ?? Bell
          return (
            <button key={n.id} className={`notice ${read[n.id] ? "" : "unread"}`} onClick={() => setRead({ ...read, [n.id]: true })}>
              <span className={`notice-icon ${n.tone}`}><Icon size={16} /></span>
              <div><strong>{s(`notif.${n.id}.title`)}</strong><p>{s(`notif.${n.id}.body`)}</p></div>
              <small>{f.date(new Date(Date.UTC(2026, 9, 27 - Number(n.id.slice(1)))).toISOString())}</small>
            </button>
          )
        })}
      </div>
    </Page>
  )
}

/* ------------------------------------------------------------------ Suporte */

export function SupportPage() {
  const { t } = useI18n()
  const s = useS()
  const [q, setQ] = useState("")
  const [open, setOpen] = useState("")
  const [subject, setSubject] = useState("account")
  const [message, setMessage] = useState("")
  const [tickets, setTickets] = useState<{ id: number; subject: string }[]>([])
  const faq = ["q1", "q2", "q3", "q4"].filter((k) => !q || `${s(`faq.${k}.q`)} ${s(`faq.${k}.a`)}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Page className="form-page">
      <Header title={t("dash.nav.support")} back />
      <div className="form-surface">
        <DemoBanner />
        <label className="search-field">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s("search")} aria-label={s("search")} />
        </label>
        <h2>{s("faqTitle")}</h2>
        <div className="faq-list">
          {faq.map((k) => (
            <button key={k} aria-expanded={open === k} onClick={() => setOpen(open === k ? "" : k)}>
              <span>{s(`faq.${k}.q`)}<small hidden={open !== k}>{s(`faq.${k}.a`)}</small></span>
              <ChevronDown size={16} />
            </button>
          ))}
          {faq.length === 0 && <p className="body-copy">{s("noResults")}</p>}
        </div>
        <h2>{s("newTicket")}</h2>
        <label className="field">
          <span>{s("subject")}</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {["account", "deposit", "withdraw", "verification", "other"].map((k) => <option key={k} value={k}>{s(`subjects.${k}`)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{s("message")}</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <button className="primary-button" disabled={message.trim().length < 5}
          onClick={() => { setTickets([{ id: tickets.length + 1, subject }, ...tickets]); setMessage("") }}>
          {s("send")}
        </button>
        <h2>{s("myTickets")}</h2>
        <div className="list-card">
          {tickets.length === 0 && <div className="transaction"><div className="transaction-main"><small>{s("noTickets")}</small></div></div>}
          {tickets.map((k) => (
            <div key={k.id} className="transaction">
              <span className="transaction-icon"><WalletCards size={16} /></span>
              <div className="transaction-main"><strong>#{k.id} · {s(`subjects.${k.subject}`)}</strong><small>{s("ticketOpen")}</small></div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  )
}
