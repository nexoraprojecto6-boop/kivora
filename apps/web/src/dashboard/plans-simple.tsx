import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Check, CircleHelp, Clock3, Wallet } from "lucide-react"
import { YIELD_CYCLE_MS, YIELD_STEPS, dayProfile, yieldDays, type PlanDto, type SubscriptionDto, type SubscriptionLiveDto, type SubscriptionPanelDto, type WalletDto } from "@kivora/shared"
import { useNavigate, useParams } from "react-router-dom"
import { useI18n } from "../i18n/I18nProvider.js"
import { platformApi } from "../services/api-client.js"
import { withLoader } from "../services/loader-store.js"
import { Header, Page } from "./App.js"
import { Gate, Load, Sub, canOperate, makeMoney, newKey, useErr, useLoad, useS, useWallet } from "./screens.js"
import { PlanCover } from "./plan-cover.js"
import "./plans-simple.css"

/*
 * Planos, versão simples.
 *   1) Lista: foto, nome e preço de cada plano.
 *   2) Detalhe: condições (escritas pelo administrador), prazo em destaque e botão de compra.
 *   3) Depois de comprar: painel com o gráfico do rendimento de hoje, quanto já gerou e o botão para enviar à carteira.
 *
 * Preço, rendimento por dia, prazo e condições vêm todos do servidor (definidos no painel de administração).
 * O dinheiro gerado é calculado no servidor com a curva de @kivora/shared; aqui a MESMA função só serve para
 * desenhar o gráfico e fazer o número avançar entre dois pedidos (de 5 em 5 segundos). Nenhuma acção usa esse valor.
 */

type Txt = Record<string, string>
const TEXT: Record<string, Txt> = {
  pt: {
    term: "Prazo", days: "{n} dias", noTerm: "Sem prazo", yieldPerDay: "Rendimento por dia", conditions: "Condições", payoutRule: "Enviar o rendimento para a carteira",
    payoutDaily: "Todos os dias", payoutEvery: "De {n} em {n} dias", buy: "Comprar por {v}", confirmTitle: "Confirmar a compra de {v}?", confirm: "Confirmar compra", cancel: "Cancelar",
    buying: "A abrir o seu plano", notReady: "Este plano ainda está a ser preparado.", comingSoon: "Este plano abre em breve.", closed: "Este plano está fechado.",
    bought: "Já adquiriu este plano. Escolha outro.", activeOther: "Já tem um plano ativo. Só pode ter um de cada vez.", seeMine: "Ver o meu plano", seeOthers: "Ver outros planos",
    lowFunds: "Saldo insuficiente: precisa de {need} e tem {have}.", deposit: "Depositar", myPlans: "Os meus planos", available: "Planos disponíveis",
    tagOwned: "Já adquirido", tagSoon: "Em breve", tagClosed: "Fechado",
    status_ACTIVE: "Ativo", status_PENDING: "A aguardar aprovação", status_COMPLETED: "Concluído", status_REJECTED: "Recusado", status_CANCELLED: "Cancelado",
    generated: "Gerado até agora", today: "Hoje", target: "Meta do dia", chartTitle: "Rendimento de hoje", chartNote: "Evolução do rendimento diário deste plano.",
    dayOf: "Dia {d} de {n}", left: "Faltam {t}", endsOn: "Termina em {d}", invested: "Valor do plano", inWallet: "Já na carteira", canSend: "Disponível para enviar",
    send: "Enviar para a carteira", sent: "Rendimento enviado para a carteira.", nextSend: "Poderá enviar dentro de {t}", nothingYet: "Ainda não há rendimento para enviar.",
    history: "Envios para a carteira", noHistory: "Ainda não enviou nada.", kindClaim: "Pedido", kindExpiry: "Fim do plano",
    pending: "O seu plano está a aguardar aprovação. O rendimento começa a contar quando for aprovado.",
    done: "Plano concluído: o valor do plano e o rendimento foram enviados para a sua carteira.", ended: "Plano terminado",
  },
  en: {
    term: "Term", days: "{n} days", noTerm: "No term", yieldPerDay: "Yield per day", conditions: "Conditions", payoutRule: "Send the yield to your wallet",
    payoutDaily: "Every day", payoutEvery: "Every {n} days", buy: "Buy for {v}", confirmTitle: "Confirm the purchase of {v}?", confirm: "Confirm purchase", cancel: "Cancel",
    buying: "Opening your plan", notReady: "This plan is still being prepared.", comingSoon: "This plan opens soon.", closed: "This plan is closed.",
    bought: "You already bought this plan. Choose another one.", activeOther: "You already have an active plan. Only one at a time.", seeMine: "See my plan", seeOthers: "See other plans",
    lowFunds: "Not enough balance: you need {need} and have {have}.", deposit: "Deposit", myPlans: "My plans", available: "Available plans",
    tagOwned: "Already bought", tagSoon: "Soon", tagClosed: "Closed",
    status_ACTIVE: "Active", status_PENDING: "Awaiting approval", status_COMPLETED: "Completed", status_REJECTED: "Rejected", status_CANCELLED: "Cancelled",
    generated: "Generated so far", today: "Today", target: "Daily target", chartTitle: "Today's yield", chartNote: "Progress of this plan's daily yield.",
    dayOf: "Day {d} of {n}", left: "{t} left", endsOn: "Ends on {d}", invested: "Plan amount", inWallet: "Already in wallet", canSend: "Available to send",
    send: "Send to wallet", sent: "Yield sent to your wallet.", nextSend: "You can send in {t}", nothingYet: "No yield to send yet.",
    history: "Sent to wallet", noHistory: "You haven't sent anything yet.", kindClaim: "Requested", kindExpiry: "Plan end",
    pending: "Your plan is awaiting approval. The yield starts counting once it is approved.",
    done: "Plan completed: the plan amount and the yield were sent to your wallet.", ended: "Plan ended",
  },
  es: {
    term: "Plazo", days: "{n} días", noTerm: "Sin plazo", yieldPerDay: "Rendimiento por día", conditions: "Condiciones", payoutRule: "Enviar el rendimiento a la cartera",
    payoutDaily: "Cada día", payoutEvery: "Cada {n} días", buy: "Comprar por {v}", confirmTitle: "¿Confirmar la compra de {v}?", confirm: "Confirmar compra", cancel: "Cancelar",
    buying: "Abriendo su plan", notReady: "Este plan aún se está preparando.", comingSoon: "Este plan abre pronto.", closed: "Este plan está cerrado.",
    bought: "Ya compró este plan. Elija otro.", activeOther: "Ya tiene un plan activo. Solo uno a la vez.", seeMine: "Ver mi plan", seeOthers: "Ver otros planes",
    lowFunds: "Saldo insuficiente: necesita {need} y tiene {have}.", deposit: "Depositar", myPlans: "Mis planes", available: "Planes disponibles",
    tagOwned: "Ya comprado", tagSoon: "Pronto", tagClosed: "Cerrado",
    status_ACTIVE: "Activo", status_PENDING: "Pendiente de aprobación", status_COMPLETED: "Completado", status_REJECTED: "Rechazado", status_CANCELLED: "Cancelado",
    generated: "Generado hasta ahora", today: "Hoy", target: "Meta del día", chartTitle: "Rendimiento de hoy", chartNote: "Evolución del rendimiento diario de este plan.",
    dayOf: "Día {d} de {n}", left: "Faltan {t}", endsOn: "Termina el {d}", invested: "Valor del plan", inWallet: "Ya en la cartera", canSend: "Disponible para enviar",
    send: "Enviar a la cartera", sent: "Rendimiento enviado a la cartera.", nextSend: "Podrá enviar dentro de {t}", nothingYet: "Aún no hay rendimiento para enviar.",
    history: "Envíos a la cartera", noHistory: "Aún no ha enviado nada.", kindClaim: "Solicitado", kindExpiry: "Fin del plan",
    pending: "Su plan está pendiente de aprobación. El rendimiento empieza a contar cuando se apruebe.",
    done: "Plan completado: el valor del plan y el rendimiento se enviaron a su cartera.", ended: "Plan terminado",
  },
  fr: {
    term: "Durée", days: "{n} jours", noTerm: "Sans durée", yieldPerDay: "Rendement par jour", conditions: "Conditions", payoutRule: "Envoyer le rendement vers le portefeuille",
    payoutDaily: "Chaque jour", payoutEvery: "Tous les {n} jours", buy: "Acheter pour {v}", confirmTitle: "Confirmer l’achat de {v} ?", confirm: "Confirmer l’achat", cancel: "Annuler",
    buying: "Ouverture de votre plan", notReady: "Ce plan est encore en préparation.", comingSoon: "Ce plan ouvre bientôt.", closed: "Ce plan est fermé.",
    bought: "Vous avez déjà acheté ce plan. Choisissez-en un autre.", activeOther: "Vous avez déjà un plan actif. Un seul à la fois.", seeMine: "Voir mon plan", seeOthers: "Voir d’autres plans",
    lowFunds: "Solde insuffisant : il vous faut {need} et vous avez {have}.", deposit: "Déposer", myPlans: "Mes plans", available: "Plans disponibles",
    tagOwned: "Déjà acheté", tagSoon: "Bientôt", tagClosed: "Fermé",
    status_ACTIVE: "Actif", status_PENDING: "En attente d’approbation", status_COMPLETED: "Terminé", status_REJECTED: "Refusé", status_CANCELLED: "Annulé",
    generated: "Généré jusqu’ici", today: "Aujourd’hui", target: "Objectif du jour", chartTitle: "Rendement d’aujourd’hui", chartNote: "Évolution du rendement quotidien de ce plan.",
    dayOf: "Jour {d} sur {n}", left: "Il reste {t}", endsOn: "Se termine le {d}", invested: "Valeur du plan", inWallet: "Déjà dans le portefeuille", canSend: "Disponible à envoyer",
    send: "Envoyer au portefeuille", sent: "Rendement envoyé au portefeuille.", nextSend: "Envoi possible dans {t}", nothingYet: "Pas encore de rendement à envoyer.",
    history: "Envois au portefeuille", noHistory: "Vous n’avez encore rien envoyé.", kindClaim: "Demandé", kindExpiry: "Fin du plan",
    pending: "Votre plan attend l’approbation. Le rendement commence à courir une fois approuvé.",
    done: "Plan terminé : la valeur du plan et le rendement ont été envoyés au portefeuille.", ended: "Plan terminé",
  },
}

function useTx() {
  const { language } = useI18n()
  const dict = TEXT[language] ?? TEXT["pt"] ?? {}
  const fallback = TEXT["pt"] ?? {}
  return {
    language,
    tx: (key: string, params: Record<string, string | number> = {}): string =>
      Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), dict[key] ?? fallback[key] ?? key),
  }
}

/* ---------- formatação (só apresentação) ---------- */

function useFmt(currency: string, language: string) {
  return useMemo(() => {
    const loc = language === "pt" ? "pt-AO" : language
    const base = new Intl.NumberFormat(loc, { style: "currency", currency })
    const factor = 10 ** (base.resolvedOptions().maximumFractionDigits ?? 2)
    const fine = new Intl.NumberFormat(loc, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 })
    const pct = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return {
      fmt: (minor: number) => base.format(minor / factor),
      fine: (minor: number) => fine.format(minor / factor),
      pct: (v: number) => `${pct.format(v)}%`,
    }
  }, [currency, language])
}

function span(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${r}s`
  return `${m}m ${r}s`
}

/** Relógio só para fazer o número e o gráfico avançarem entre dois pedidos ao servidor. */
function useTick(ms = 1000): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((v) => v + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return n
}

const isSimple = (p: PlanDto): boolean => p.dailyYieldMinor != null && p.minMinor !== null && p.minMinor === p.maxMinor
const OWNED = ["PENDING", "ACTIVE", "COMPLETED"]
const RUNNING = ["PENDING", "ACTIVE"]
const TONE: Record<string, string> = { ACTIVE: "ok", COMPLETED: "ok", PENDING: "wait", REJECTED: "bad", CANCELLED: "bad" }

/* ============================== cartão do plano (foto, nome, preço) ============================== */

export function PlanCard({ plan, index, currency, compact = false, tag }: { plan: PlanDto; index: number; currency: string; compact?: boolean; tag?: string }) {
  const navigate = useNavigate()
  const { tx, language } = useTx()
  const m = useMemo(() => makeMoney(language, currency), [language, currency])
  const go = () => navigate(`/plans/${plan.id}`)
  const label = tag ?? (plan.status === "COMING_SOON" ? tx("tagSoon") : plan.status === "CLOSED" ? tx("tagClosed") : "")
  return (
    <div className={`ps-plan ${compact ? "compact" : ""}`} role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === "Enter" && go()}>
      <PlanCover imageUrl={plan.imageUrl} index={index} variant="hero" />
      <div className="ps-plan-body">
        <strong className="ps-plan-name">{plan.name}</strong>
        {plan.minMinor !== null && <b className="ps-plan-price">{m.fmt(plan.minMinor)}</b>}
        {label && <span className="ps-tag">{label}</span>}
      </div>
    </div>
  )
}

/* ============================== lista de planos ============================== */

export function PlansPage() {
  const { t } = useI18n()
  const s = useS()
  const { tx } = useTx()
  const wallet = useWallet()
  const plans = useLoad(() => platformApi.plans(), [])
  const subs = useLoad(() => platformApi.subscriptions({ silent: true }), [], ["subscriptions"])
  return (
    <Page className="plans-page ps-page">
      <Header title={t("dash.nav.plans")} back />
      <Load q={wallet}>{(w) => (
        <Load q={plans}>{(list) => {
          const mine = (subs.data ?? []).filter((x) => x.status === "ACTIVE" || x.status === "PENDING" || x.status === "COMPLETED")
          const owned = new Set(mine.map((x) => x.planId))
          const shown = list.filter((p) => p.status === "OPEN" || p.status === "COMING_SOON")
          return (
            <div className="ps-list">
              {mine.length > 0 && (
                <section>
                  <h2 className="ps-section">{tx("myPlans")}</h2>
                  <div className="ps-mine">
                    {mine.map((x) => <MineRow key={x.id} s={x} plan={list.find((p) => p.id === x.planId) ?? null} currency={w.currency} />)}
                  </div>
                </section>
              )}
              {shown.length === 0
                ? <div className="info-box"><CircleHelp size={18} /><p>{s("emptyPlans")}</p></div>
                : (
                  <section>
                    {mine.length > 0 && <h2 className="ps-section">{tx("available")}</h2>}
                    <div className="ps-grid">
                      {shown.map((p) => <PlanCard key={p.id} plan={p} index={list.indexOf(p)} currency={w.currency} {...(owned.has(p.id) ? { tag: tx("tagOwned") } : {})} />)}
                    </div>
                  </section>
                )}
            </div>
          )
        }}</Load>
      )}</Load>
    </Page>
  )
}

function MineRow({ s, plan, currency }: { s: SubscriptionDto; plan: PlanDto | null; currency: string }) {
  const navigate = useNavigate()
  const { tx, language } = useTx()
  const f = useFmt(currency, language)
  return (
    <button type="button" className="ps-row" onClick={() => navigate(`/subscriptions/${s.id}`)}>
      <span className="ps-row-main">
        <PlanCover imageUrl={plan?.imageUrl ?? null} variant="thumb" />
        <span className="ps-row-text"><b>{s.planName}</b><small>{f.fmt(s.amountMinor)}</small></span>
      </span>
      <span className={`ps-chip ${TONE[s.status] ?? ""}`}>{tx(`status_${s.status}`)}</span>
      <ArrowRight size={16} />
    </button>
  )
}

/* ============================== detalhe do plano + compra ============================== */

export function PlanDetailPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { tx, language } = useTx()
  const err = useErr()
  const wallet = useWallet()
  const plan = useLoad(() => platformApi.plan(id), [id])
  const subs = useLoad(() => platformApi.subscriptions({ silent: true }), [], ["subscriptions"])
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const key = useRef(newKey())

  return (
    <Sub title={plan.data?.name ?? ""} className="ps-page">
      <Load q={wallet}>{(w) => <Load q={plan}>{(p) => body(w, p)}</Load>}</Load>
    </Sub>
  )

  function body(w: WalletDto, p: PlanDto) {
    const m = makeMoney(language, w.currency)
    const price = p.minMinor
    const all = subs.data ?? []
    const ownedHere = all.find((x) => x.planId === p.id && OWNED.includes(x.status))
    const running = all.find((x) => RUNNING.includes(x.status))
    const text = (p.conditions ?? "").trim() || (p.description ?? "").trim()
    const dailyYield = p.dailyYieldMinor ?? null
    const dailyPct = dailyYield !== null && price ? (dailyYield / price) * 100 : null
    const f = { pct: (v: number) => `${v.toLocaleString(language === "pt" ? "pt-AO" : language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` }

    const buy = async () => {
      if (price === null) return
      setError("")
      setBusy(true)
      try {
        const sub = await withLoader({ title: tx("buying") }, () => platformApi.subscribe(p.id, price, key.current))
        key.current = newKey()
        navigate(`/subscriptions/${sub.id}`)
      } catch (e) {
        setError(err(e))
        setBusy(false)
        setConfirm(false)
      }
    }

    // Uma mensagem só, a que mais ajuda: porque é que não se pode comprar (ou nada, se pode).
    let blocked: { text: string; action?: { label: string; go: () => void } } | null = null
    if (p.status === "COMING_SOON") blocked = { text: tx("comingSoon") }
    else if (p.status === "CLOSED") blocked = { text: tx("closed") }
    else if (!isSimple(p)) blocked = { text: tx("notReady") }
    else if (ownedHere) {
      blocked = { text: tx("bought"), action: RUNNING.includes(ownedHere.status) ? { label: tx("seeMine"), go: () => navigate(`/subscriptions/${ownedHere.id}`) } : { label: tx("seeOthers"), go: () => navigate("/plans") } }
    } else if (running) {
      blocked = { text: tx("activeOther"), action: { label: tx("seeMine"), go: () => navigate(`/subscriptions/${running.id}`) } }
    }

    return (
      <div className="ps">
        <PlanCover imageUrl={p.imageUrl} variant="hero" />
        <div className="ps-head">
          <h2 className="ps-name">{p.name}</h2>
          {p.marketLabel && <small className="ps-sub">{p.marketLabel}</small>}
          {price !== null && <div className="ps-price">{m.fmt(price)}</div>}
        </div>

        {text && (
          <section className="ps-card">
            <h3>{tx("conditions")}</h3>
            <p className="ps-text">{text}</p>
          </section>
        )}

        <section className="ps-term" aria-label={tx("term")}>
          <small>{tx("term")}</small>
          <strong>{p.termDays === null ? tx("noTerm") : tx("days", { n: p.termDays })}</strong>
        </section>

        <div className="ps-facts">
          {dailyYield !== null && (
            <div><small>{tx("yieldPerDay")}</small><strong>{m.fmt(dailyYield)}</strong>{dailyPct !== null && <em>{f.pct(dailyPct)}</em>}</div>
          )}
          <div><small>{tx("payoutRule")}</small><strong>{p.payoutIntervalDays === 1 ? tx("payoutDaily") : tx("payoutEvery", { n: p.payoutIntervalDays })}</strong></div>
        </div>

        <Gate w={w} />
        {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
        {blocked ? (
          <div className="ps-blocked" role="note">
            <p>{blocked.text}</p>
            {blocked.action && <button type="button" className="ps-ghost" onClick={blocked.action.go}>{blocked.action.label} <ArrowRight size={14} /></button>}
          </div>
        ) : canOperate(w) && price !== null ? (
          price > w.available ? (
            <div className="ps-blocked" role="note">
              <p>{tx("lowFunds", { need: m.fmt(price), have: m.fmt(w.available) })}</p>
              <button type="button" className="ps-ghost" onClick={() => navigate("/deposit")}>{tx("deposit")} <ArrowRight size={14} /></button>
            </div>
          ) : confirm ? (
            <div className="ps-confirm">
              <p>{tx("confirmTitle", { v: m.fmt(price) })}</p>
              <div className="ps-confirm-row">
                <button type="button" className="ps-ghost" disabled={busy} onClick={() => setConfirm(false)}>{tx("cancel")}</button>
                <button type="button" className="ps-buy" disabled={busy} onClick={() => void buy()}>{tx("confirm")}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="ps-buy" onClick={() => setConfirm(true)}>{tx("buy", { v: m.fmt(price) })} <ArrowRight size={16} /></button>
          )
        ) : null}
      </div>
    )
  }
}

/* ============================== painel do plano comprado ============================== */

export function PlanPanelPage() {
  const { id = "" } = useParams()
  const [tick, setTick] = useState(0)
  const panel = useLoad(() => platformApi.panel(id), [id, tick])
  return (
    <Sub title={panel.data?.plan.name ?? ""} className="ps-page">
      <Load q={panel}>{(d) => <PanelBody key={`${d.subscription.id}:${tick}`} data={d} reload={() => setTick((n) => n + 1)} />}</Load>
    </Sub>
  )
}

const POLL_MS = 5000

function PanelBody({ data, reload }: { data: SubscriptionPanelDto; reload: () => void }) {
  const { tx, language } = useTx()
  const err = useErr()
  const { subscription: sub, plan } = data
  const f = useFmt(sub.currency, language)
  const [live, setLive] = useState<SubscriptionLiveDto>(data.live)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const sync = useRef({ at: Date.now(), offset: Date.parse(data.live.serverTime) - Date.now() })
  useTick(1000)

  const poll = useCallback(async () => {
    try {
      const next = await platformApi.live(sub.id, null)
      sync.current = { at: Date.now(), offset: Date.parse(next.serverTime) - Date.now() }
      setLive(next)
      if (next.status !== data.live.status) reload()
    } catch {
      // falha de rede ou de sessão: mantém o último estado e tenta no ciclo seguinte
    }
  }, [sub.id, data.live.status, reload])

  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) void poll() }, POLL_MS)
    const onVisible = () => { if (!document.hidden) void poll() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible) }
  }, [poll])

  const active = live.status === "ACTIVE"
  const y = plan.dailyYieldMinor ?? null
  const startMs = sub.startsAt ? Date.parse(sub.startsAt) : null
  const endMs = sub.endsAt ? Date.parse(sub.endsAt) : null
  const nowMs = Date.now() + sync.current.offset
  const capNow = endMs !== null ? Math.min(nowMs, endMs) : nowMs
  const serverMs = Date.parse(live.serverTime)

  // Gerado: o que o servidor disse no último pedido + o avanço da curva desde então (só para o ecrã não ficar parado).
  let generated = live.earnings.generatedMinor
  if (active && y !== null && startMs !== null) {
    generated += y * (yieldDays(sub.id, capNow - startMs) - yieldDays(sub.id, Math.min(serverMs, capNow) - startMs))
  }
  const claimable = Math.max(0, Math.floor(generated) - live.earnings.claimedMinor)

  // Hoje (o dia de 24 h em curso, contado desde o início do plano).
  const lastMs = endMs !== null && startMs !== null ? endMs - startMs - 1 : Number.POSITIVE_INFINITY
  const elapsed = startMs !== null ? Math.min(Math.max(0, capNow - startMs), lastMs) : 0
  const cycle = Math.floor(elapsed / YIELD_CYCLE_MS)
  const todayMinor = y !== null ? y * (yieldDays(sub.id, elapsed) - cycle) : 0
  const price = sub.amountMinor
  const remainingLocal = live.remainingSeconds === null ? null : Math.max(0, live.remainingSeconds - (Date.now() - sync.current.at) / 1000)
  const untilClaim = live.payout.nextClaimAt ? (Date.parse(live.payout.nextClaimAt) - nowMs) / 1000 : null

  const claim = async () => {
    setMsg(null)
    try {
      const next = await platformApi.claimEarnings(sub.id)
      sync.current = { at: Date.now(), offset: Date.parse(next.serverTime) - Date.now() }
      setLive(next)
      setMsg({ ok: true, text: tx("sent") })
    } catch (e) {
      setMsg({ ok: false, text: err(e) })
    }
  }

  return (
    <div className="ps">
      <PlanCover imageUrl={plan.imageUrl} variant="hero" />
      <div className="ps-head ps-head--row">
        <div className="ps-head">
          <h2 className="ps-name">{plan.name}</h2>
          {plan.marketLabel && <small className="ps-sub">{plan.marketLabel}</small>}
        </div>
        <span className={`ps-chip ${TONE[live.status] ?? ""}`}>{tx(`status_${live.status}`)}</span>
      </div>

      {live.status === "PENDING" && <div className="info-box" role="note"><Clock3 size={18} /><p>{tx("pending")}</p></div>}
      {live.status === "COMPLETED" && <div className="info-box" role="status"><Check size={18} /><p>{tx("done")}</p></div>}

      <section className="ps-total" aria-label={tx("generated")}>
        <small>{tx("generated")}</small>
        <div className="ps-big">{f.fine(generated)}</div>
      </section>

      {active && y !== null && startMs !== null && (
        <section className="ps-card">
          <div className="ps-chart-head">
            <h3>{tx("chartTitle")}</h3>
            <span>{tx("dayOf", { d: Math.min(cycle + 1, plan.termDays ?? cycle + 1), n: plan.termDays ?? "—" })}</span>
          </div>
          <div className="ps-today">
            <strong>+{f.fine(todayMinor)}</strong>
            <span>{f.pct((todayMinor / price) * 100)}</span>
          </div>
          <DayChart seed={sub.id} yieldMinor={y} elapsed={elapsed} cycleStartMs={startMs + cycle * YIELD_CYCLE_MS} language={language} fmt={f.fmt} />
          <div className="ps-target">
            <span>{tx("target")}</span>
            <b>{f.fmt(y)} · {f.pct((y / price) * 100)}</b>
          </div>
          <p className="ps-note">{tx("chartNote")}</p>
        </section>
      )}

      <div className="ps-facts">
        <div><small>{tx("invested")}</small><strong>{f.fmt(price)}</strong></div>
        <div>
          <small>{tx("term")}</small>
          <strong>{active && remainingLocal !== null ? tx("left", { t: span(remainingLocal) }) : live.status === "COMPLETED" ? tx("ended") : plan.termDays === null ? tx("noTerm") : tx("days", { n: plan.termDays })}</strong>
          {active && sub.endsAt && <em>{tx("endsOn", { d: new Date(sub.endsAt).toLocaleDateString(language) })}</em>}
        </div>
        <div><small>{tx("inWallet")}</small><strong>{f.fmt(live.earnings.claimedMinor)}</strong></div>
        <div><small>{tx("canSend")}</small><strong>{f.fmt(claimable)}</strong></div>
      </div>

      {active && (
        <section className="ps-card">
          <h3><Wallet size={15} /> {tx("send")}</h3>
          <p className="ps-note">{tx("payoutRule")}: {live.payout.intervalDays === 1 ? tx("payoutDaily") : tx("payoutEvery", { n: live.payout.intervalDays })}</p>
          {msg && <div className={`info-box ${msg.ok ? "" : "bad"}`} role={msg.ok ? "status" : "alert"}>{msg.ok ? <Check size={18} /> : <CircleHelp size={18} />}<p>{msg.text}</p></div>}
          <button type="button" className="ps-buy" disabled={!live.payout.canClaim} onClick={() => void claim()}>{tx("send")} · {f.fmt(live.earnings.claimableMinor)}</button>
          {!live.payout.canClaim && untilClaim !== null && untilClaim > 0 && <p className="ps-note">{tx("nextSend", { t: span(untilClaim) })}</p>}
          {!live.payout.canClaim && (untilClaim === null || untilClaim <= 0) && live.earnings.claimableMinor < 1 && <p className="ps-note">{tx("nothingYet")}</p>}
        </section>
      )}

      <section className="ps-card">
        <h3>{tx("history")}</h3>
        {data.payouts.length === 0
          ? <p className="ps-note">{tx("noHistory")}</p>
          : data.payouts.map((p) => (
            <div key={p.id} className="ps-pay"><span>{new Date(p.createdAt).toLocaleString(language)}<small>{tx(p.kind === "CLAIM" ? "kindClaim" : "kindExpiry")}</small></span><b>+{f.fmt(p.amountMinor)}</b></div>
          ))}
      </section>
    </div>
  )
}

/* ============================== gráfico do dia ============================== */

const CW = 320, CH = 150, PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 20

/**
 * Gráfico simples do rendimento de hoje: sobe do zero (início do dia) até à meta (rendimento definido para o dia).
 * Usa a mesma curva que o servidor usa para calcular o dinheiro, por isso o ponto de agora é o que já foi gerado hoje.
 */
function DayChart({ seed, yieldMinor, elapsed, cycleStartMs, language, fmt }: { seed: string; yieldMinor: number; elapsed: number; cycleStartMs: number; language: string; fmt: (minor: number) => string }) {
  const cycle = Math.floor(elapsed / YIELD_CYCLE_MS)
  const cum = dayProfile(seed, cycle)
  const pos = ((elapsed - cycle * YIELD_CYCLE_MS) / YIELD_CYCLE_MS) * YIELD_STEPS
  const whole = Math.min(YIELD_STEPS - 1, Math.floor(pos))
  const x = (i: number): number => PAD_L + (i / YIELD_STEPS) * (CW - PAD_L - PAD_R)
  const yy = (frac: number): number => PAD_T + (1 - frac) * (CH - PAD_T - PAD_B)
  const a = cum[whole] ?? 0
  const b = cum[whole + 1] ?? 1
  const nowFrac = a + (b - a) * (pos - whole)
  const pts: [number, number][] = []
  for (let i = 0; i <= whole; i++) pts.push([x(i), yy(cum[i] ?? 0)])
  pts.push([x(pos), yy(nowFrac)])
  const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ")
  const base = yy(0)
  const area = `${line} L${x(pos).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`
  const hour = new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" })
  const startLabel = hour.format(new Date(cycleStartMs))
  const endLabel = hour.format(new Date(cycleStartMs + YIELD_CYCLE_MS))
  const gid = `psg-${seed.slice(0, 8)}`
  return (
    <svg className="ps-chart" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={fmt(yieldMinor * nowFrac)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line className="ps-grid-line ps-grid-line--target" x1={PAD_L} x2={CW - PAD_R} y1={yy(1)} y2={yy(1)} />
      <line className="ps-grid-line" x1={PAD_L} x2={CW - PAD_R} y1={yy(0.5)} y2={yy(0.5)} />
      <line className="ps-grid-line" x1={PAD_L} x2={CW - PAD_R} y1={base} y2={base} />
      <path d={area} fill={`url(#${gid})`} />
      <path className="ps-line" d={line} fill="none" />
      <circle className="ps-dot" cx={x(pos)} cy={yy(nowFrac)} r="4" />
      <text className="ps-axis" x={PAD_L} y={CH - 5}>{startLabel}</text>
      <text className="ps-axis" x={CW - PAD_R} y={CH - 5} textAnchor="end">{endLabel}</text>
    </svg>
  )
}
