import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Check, CircleHelp, Clock3, Gem, Gift, Layers, Lock, PieChart, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import type { EarningsSeriesDto, MarketPointDto, PlanDto, SeriesBucket, SubscriptionDto, SubscriptionLiveDto, SubscriptionPanelDto, WalletDto } from "@kivora/shared"
import { useNavigate, useParams } from "react-router-dom"
import { useI18n } from "../i18n/I18nProvider.js"
import { assetUrl, platformApi } from "../services/api-client.js"
import { withLoader } from "../services/loader-store.js"
import { Gate, Load, Sub, canOperate, makeMoney, newKey, useErr, useLoad } from "./screens.js"
import "./plan-panel.css"

/*
 * Plano: página de detalhe (antes de investir) e painel do plano (depois).
 * Tudo o que aparece vem do servidor: taxas, mercado, comissão, prazo, levantamentos. Este ficheiro só mostra.
 * A única conta local é VISUAL: entre dois pedidos ao servidor (de 5 em 5 segundos) o contador de comissão avança
 * ao ritmo que o servidor indicou, para o ecrã não ficar parado. Nenhuma acção (levantar) usa esse valor.
 */
type Txt = Record<string, string>
const TEXT: Record<string, Txt> = {
  pt: {
    invest: "Investir", investing: "A abrir o seu plano", amount: "Valor a investir", available: "Disponível: {v}", minEntry: "Valor de entrada", upTo: "até {v}", term: "Prazo", days: "{n} dias", noTerm: "Sem prazo",
    daily: "Percentagem diária", dailyNormal: "Normal", dailyMin: "Mínima", dailyMax: "Limite", perDay: "ao dia", how: "Como funciona", risk: "Riscos", market: "Mercado de referência",
    marketBody: "A percentagem do plano acompanha este mercado em tempo real: se o mercado desce, a percentagem desce até à mínima; se sobe, a percentagem sobe até ao limite do plano.",
    fixedBody: "A percentagem diária deste plano é fixa.", payout: "Levantamento da comissão", payoutBody: "Pode enviar a comissão para a carteira de {n} em {n} dias.", payoutDaily: "Pode enviar a comissão para a carteira todos os dias.",
    boost: "Bónus de convite", boostBody: "Se um convidado seu assinar um plano, a percentagem deste plano passa a ser x{m}.", invalid: "Valor inválido.", myPlans: "Os meus planos", open: "Abrir painel", loading: "A carregar…",
    status_PENDING: "A aguardar aprovação", status_ACTIVE: "Ativo", status_COMPLETED: "Concluído", status_REJECTED: "Recusado", status_CANCELLED: "Cancelado",
    status_OPEN: "Aberto", status_COMING_SOON: "Em breve", status_CLOSED: "Fechado",
    invested: "Valor investido", rate: "Percentagem de agora", rateEff: "Com bónus de convite", rateLimitMax: "No limite máximo do plano", rateLimitMin: "Na percentagem mínima", rateStale: "Mercado sem dados: a usar a percentagem normal",
    live: "Mercado em tempo real", price: "Preço", change: "Variação", noMarket: "Este plano não tem mercado associado.", waiting: "A aguardar dados do mercado…",
    generated: "Total gerado", claimed: "Já na carteira", claimable: "Disponível para levantar", lastMinute: "Último minuto", lastHour: "Última hora", lastDay: "Últimas 24 h", pace: "Ritmo de agora", perMinute: "por minuto", perHour: "por hora", perDayL: "por dia",
    claim: "Enviar para a carteira", claimDone: "Comissão enviada para a carteira.", nextClaim: "Poderá levantar dentro de {t}", nothing: "Ainda não há comissão para levantar.", destination: "Destino: saldo da carteira",
    remaining: "Tempo restante", endsAt: "Termina em {d}", ended: "Plano terminado", seriesTitle: "Comissão gerada", minute: "Minuto", hour: "Hora", day: "Dia",
    boostActive: "Bónus de convite ativo: x{m}", boostInactive: "Convide um amigo que assine um plano para ter x{m} neste plano.", invitees: "{n} convidado(s) com plano", invite: "Convidar",
    history: "Levantamentos", noPayouts: "Ainda não fez levantamentos.", kindClaim: "Pedido", kindExpiry: "Fim do plano", pendingNote: "O seu plano está a aguardar aprovação. A comissão começa a contar quando for aprovado.",
    completedNote: "Plano concluído: o capital e a comissão foram enviados para a sua carteira.", err: "Não foi possível carregar.", retry: "Tentar novamente", sourceNote: "Dados de mercado fornecidos por terceiros e podem ter atraso.",
  },
  en: {
    invest: "Invest", investing: "Opening your plan", amount: "Amount to invest", available: "Available: {v}", minEntry: "Entry amount", upTo: "up to {v}", term: "Term", days: "{n} days", noTerm: "No term",
    daily: "Daily percentage", dailyNormal: "Normal", dailyMin: "Minimum", dailyMax: "Limit", perDay: "per day", how: "How it works", risk: "Risks", market: "Reference market",
    marketBody: "The plan's percentage follows this market in real time: if the market falls the percentage falls down to the minimum; if it rises, the percentage rises up to the plan's limit.",
    fixedBody: "This plan's daily percentage is fixed.", payout: "Commission withdrawal", payoutBody: "You can send the commission to your wallet every {n} days.", payoutDaily: "You can send the commission to your wallet every day.",
    boost: "Invite bonus", boostBody: "If one of your invitees subscribes to a plan, this plan's percentage becomes x{m}.", invalid: "Invalid amount.", myPlans: "My plans", open: "Open dashboard", loading: "Loading…",
    status_PENDING: "Awaiting approval", status_ACTIVE: "Active", status_COMPLETED: "Completed", status_REJECTED: "Rejected", status_CANCELLED: "Cancelled",
    status_OPEN: "Open", status_COMING_SOON: "Coming soon", status_CLOSED: "Closed",
    invested: "Amount invested", rate: "Current percentage", rateEff: "With invite bonus", rateLimitMax: "At the plan's maximum limit", rateLimitMin: "At the minimum percentage", rateStale: "No market data: using the normal percentage",
    live: "Live market", price: "Price", change: "Change", noMarket: "This plan has no market attached.", waiting: "Waiting for market data…",
    generated: "Total generated", claimed: "Already in wallet", claimable: "Available to withdraw", lastMinute: "Last minute", lastHour: "Last hour", lastDay: "Last 24 h", pace: "Current pace", perMinute: "per minute", perHour: "per hour", perDayL: "per day",
    claim: "Send to wallet", claimDone: "Commission sent to your wallet.", nextClaim: "You can withdraw in {t}", nothing: "No commission to withdraw yet.", destination: "Destination: wallet balance",
    remaining: "Time left", endsAt: "Ends on {d}", ended: "Plan ended", seriesTitle: "Commission generated", minute: "Minute", hour: "Hour", day: "Day",
    boostActive: "Invite bonus active: x{m}", boostInactive: "Invite a friend who subscribes to a plan to get x{m} on this plan.", invitees: "{n} invitee(s) on a plan", invite: "Invite",
    history: "Withdrawals", noPayouts: "No withdrawals yet.", kindClaim: "Requested", kindExpiry: "Plan end", pendingNote: "Your plan is awaiting approval. Commission starts counting once it is approved.",
    completedNote: "Plan completed: the capital and the commission were sent to your wallet.", err: "Could not load.", retry: "Try again", sourceNote: "Market data comes from third parties and may be delayed.",
  },
  es: {
    invest: "Invertir", investing: "Abriendo su plan", amount: "Importe a invertir", available: "Disponible: {v}", minEntry: "Importe de entrada", upTo: "hasta {v}", term: "Plazo", days: "{n} días", noTerm: "Sin plazo",
    daily: "Porcentaje diario", dailyNormal: "Normal", dailyMin: "Mínimo", dailyMax: "Límite", perDay: "al día", how: "Cómo funciona", risk: "Riesgos", market: "Mercado de referencia",
    marketBody: "El porcentaje del plan sigue este mercado en tiempo real: si el mercado baja, el porcentaje baja hasta el mínimo; si sube, el porcentaje sube hasta el límite del plan.",
    fixedBody: "El porcentaje diario de este plan es fijo.", payout: "Retiro de la comisión", payoutBody: "Puede enviar la comisión a la cartera cada {n} días.", payoutDaily: "Puede enviar la comisión a la cartera cada día.",
    boost: "Bono por invitación", boostBody: "Si un invitado suyo contrata un plan, el porcentaje de este plan pasa a x{m}.", invalid: "Importe no válido.", myPlans: "Mis planes", open: "Abrir panel", loading: "Cargando…",
    status_PENDING: "Pendiente de aprobación", status_ACTIVE: "Activo", status_COMPLETED: "Completado", status_REJECTED: "Rechazado", status_CANCELLED: "Cancelado",
    status_OPEN: "Abierto", status_COMING_SOON: "Próximamente", status_CLOSED: "Cerrado",
    invested: "Importe invertido", rate: "Porcentaje actual", rateEff: "Con bono de invitación", rateLimitMax: "En el límite máximo del plan", rateLimitMin: "En el porcentaje mínimo", rateStale: "Sin datos de mercado: usando el porcentaje normal",
    live: "Mercado en tiempo real", price: "Precio", change: "Variación", noMarket: "Este plan no tiene mercado asociado.", waiting: "Esperando datos del mercado…",
    generated: "Total generado", claimed: "Ya en la cartera", claimable: "Disponible para retirar", lastMinute: "Último minuto", lastHour: "Última hora", lastDay: "Últimas 24 h", pace: "Ritmo actual", perMinute: "por minuto", perHour: "por hora", perDayL: "por día",
    claim: "Enviar a la cartera", claimDone: "Comisión enviada a la cartera.", nextClaim: "Podrá retirar dentro de {t}", nothing: "Aún no hay comisión para retirar.", destination: "Destino: saldo de la cartera",
    remaining: "Tiempo restante", endsAt: "Termina el {d}", ended: "Plan terminado", seriesTitle: "Comisión generada", minute: "Minuto", hour: "Hora", day: "Día",
    boostActive: "Bono de invitación activo: x{m}", boostInactive: "Invite a un amigo que contrate un plan para tener x{m} en este plan.", invitees: "{n} invitado(s) con plan", invite: "Invitar",
    history: "Retiros", noPayouts: "Aún no hay retiros.", kindClaim: "Solicitado", kindExpiry: "Fin del plan", pendingNote: "Su plan está pendiente de aprobación. La comisión empieza a contar cuando se apruebe.",
    completedNote: "Plan completado: el capital y la comisión se enviaron a su cartera.", err: "No se pudo cargar.", retry: "Reintentar", sourceNote: "Los datos de mercado vienen de terceros y pueden tener retraso.",
  },
  fr: {
    invest: "Investir", investing: "Ouverture de votre plan", amount: "Montant à investir", available: "Disponible : {v}", minEntry: "Montant d’entrée", upTo: "jusqu’à {v}", term: "Durée", days: "{n} jours", noTerm: "Sans durée",
    daily: "Pourcentage quotidien", dailyNormal: "Normal", dailyMin: "Minimum", dailyMax: "Limite", perDay: "par jour", how: "Comment ça marche", risk: "Risques", market: "Marché de référence",
    marketBody: "Le pourcentage du plan suit ce marché en temps réel : si le marché baisse, le pourcentage baisse jusqu’au minimum ; s’il monte, le pourcentage monte jusqu’à la limite du plan.",
    fixedBody: "Le pourcentage quotidien de ce plan est fixe.", payout: "Retrait de la commission", payoutBody: "Vous pouvez envoyer la commission vers le portefeuille tous les {n} jours.", payoutDaily: "Vous pouvez envoyer la commission vers le portefeuille chaque jour.",
    boost: "Bonus de parrainage", boostBody: "Si un de vos invités souscrit à un plan, le pourcentage de ce plan passe à x{m}.", invalid: "Montant invalide.", myPlans: "Mes plans", open: "Ouvrir le tableau", loading: "Chargement…",
    status_PENDING: "En attente d’approbation", status_ACTIVE: "Actif", status_COMPLETED: "Terminé", status_REJECTED: "Refusé", status_CANCELLED: "Annulé",
    status_OPEN: "Ouvert", status_COMING_SOON: "Bientôt", status_CLOSED: "Fermé",
    invested: "Montant investi", rate: "Pourcentage actuel", rateEff: "Avec bonus de parrainage", rateLimitMax: "À la limite maximale du plan", rateLimitMin: "Au pourcentage minimum", rateStale: "Pas de données de marché : pourcentage normal utilisé",
    live: "Marché en temps réel", price: "Prix", change: "Variation", noMarket: "Ce plan n’a pas de marché associé.", waiting: "En attente des données du marché…",
    generated: "Total généré", claimed: "Déjà dans le portefeuille", claimable: "Disponible au retrait", lastMinute: "Dernière minute", lastHour: "Dernière heure", lastDay: "Dernières 24 h", pace: "Rythme actuel", perMinute: "par minute", perHour: "par heure", perDayL: "par jour",
    claim: "Envoyer au portefeuille", claimDone: "Commission envoyée au portefeuille.", nextClaim: "Retrait possible dans {t}", nothing: "Pas encore de commission à retirer.", destination: "Destination : solde du portefeuille",
    remaining: "Temps restant", endsAt: "Se termine le {d}", ended: "Plan terminé", seriesTitle: "Commission générée", minute: "Minute", hour: "Heure", day: "Jour",
    boostActive: "Bonus de parrainage actif : x{m}", boostInactive: "Invitez un ami qui souscrit à un plan pour avoir x{m} sur ce plan.", invitees: "{n} invité(s) avec un plan", invite: "Inviter",
    history: "Retraits", noPayouts: "Aucun retrait pour le moment.", kindClaim: "Demandé", kindExpiry: "Fin du plan", pendingNote: "Votre plan attend l’approbation. La commission commence à courir une fois approuvé.",
    completedNote: "Plan terminé : le capital et la commission ont été envoyés au portefeuille.", err: "Impossible de charger.", retry: "Réessayer", sourceNote: "Les données de marché viennent de tiers et peuvent être retardées.",
  },
}

function useTxt() {
  const { language } = useI18n()
  const dict = TEXT[language] ?? TEXT["pt"]!
  const fallback = TEXT["pt"]!
  return {
    language,
    tx: (key: string, params: Record<string, string | number> = {}): string =>
      Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), dict[key] ?? fallback[key] ?? key),
  }
}
type Tx = ReturnType<typeof useTxt>["tx"]

/* ---------- formatação (só apresentação) ---------- */
const pct = (bps: number): string => `${(bps / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const mult = (x100: number): string => (x100 / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })

function useFine(currency: string, language: string) {
  return useMemo(() => {
    const loc = language === "pt" ? "pt-AO" : language
    const base = new Intl.NumberFormat(loc, { style: "currency", currency })
    const factor = 10 ** (base.resolvedOptions().maximumFractionDigits ?? 2)
    const fine = new Intl.NumberFormat(loc, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 })
    return { fmt: (minor: number) => base.format(minor / factor), fine: (minor: number) => fine.format(minor / factor) }
  }, [currency, language])
}

function span(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${r}s`
  return `${m}m ${r}s`
}

/** Relógio de 1 s só para animar contagens decrescentes e o contador visual. */
function useTick(ms = 1000): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((v) => v + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return n
}

function PlanArt({ plan }: { plan: Pick<PlanDto, "imageUrl" | "name"> }) {
  if (plan.imageUrl) return <img className="pp-art" src={assetUrl(plan.imageUrl)} alt="" />
  return <div className="pp-art pp-art--fallback" aria-hidden="true"><Gem size={56} /></div>
}

const STATUS_TONE: Record<string, string> = { ACTIVE: "ok", COMPLETED: "ok", OPEN: "ok", PENDING: "wait", COMING_SOON: "wait", REJECTED: "bad", CANCELLED: "bad", CLOSED: "bad" }

/* ============================== detalhe do plano ============================== */

export function PlanDetailPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { tx, language } = useTxt()
  const err = useErr()
  const wallet = useLoad(() => platformApi.wallet(), [])
  const plan = useLoad(() => platformApi.plan(id), [id])
  const subs = useLoad(() => platformApi.subscriptions({ silent: true }), [])
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const key = useRef(newKey())

  return (
    <Sub title={plan.data?.name ?? ""}>
      <Load q={wallet}>{(w) => <Load q={plan}>{(p) => body(w, p)}</Load>}</Load>
    </Sub>
  )

  function body(w: WalletDto, p: PlanDto) {
    const m = makeMoney(language, w.currency)
    const open = p.status === "OPEN"
    const mine = (subs.data ?? []).filter((s) => s.planId === p.id && (s.status === "ACTIVE" || s.status === "PENDING"))
    const submit = async () => {
      setError("")
      const minor = m.toMinor(amount)
      if (minor === null) return setError(tx("invalid"))
      setBusy(true)
      try {
        const sub = await withLoader({ title: tx("investing") }, () => platformApi.subscribe(p.id, minor, key.current))
        key.current = newKey()
        navigate(`/subscriptions/${sub.id}`)
      } catch (e) {
        setError(err(e))
        setBusy(false)
      }
    }
    return (
      <div className="pp">
        <PlanArt plan={p} />
        <div className="pp-title">
          <h1>{p.name}</h1>
          <span className={`pp-chip ${STATUS_TONE[p.status] ?? ""}`}>{tx(`status_${p.status}`)}</span>
        </div>
        {p.description && <p className="pp-text">{p.description}</p>}

        <section className="pp-card">
          <h2><Sparkles size={16} /> {tx("daily")}</h2>
          <div className="pp-rates">
            <div><small>{tx("dailyNormal")}</small><strong>{pct(p.baseRateBps)}</strong><em>{tx("perDay")}</em></div>
            {p.rateMode === "MARKET" && <div><small>{tx("dailyMin")}</small><strong>{pct(p.minRateBps)}</strong><em>{tx("perDay")}</em></div>}
            {p.rateMode === "MARKET" && <div><small>{tx("dailyMax")}</small><strong>{pct(p.maxRateBps)}</strong><em>{tx("perDay")}</em></div>}
          </div>
          <p className="pp-note">{p.rateMode === "MARKET" ? `${tx("marketBody")}${p.marketLabel || p.marketSymbol ? ` (${p.marketLabel || p.marketSymbol})` : ""}` : tx("fixedBody")}</p>
        </section>

        <div className="pp-grid">
          {p.minMinor !== null && <div><small>{tx("minEntry")}</small><strong>{m.fmt(p.minMinor)}</strong>{p.maxMinor !== null && <em>{tx("upTo", { v: m.fmt(p.maxMinor) })}</em>}</div>}
          <div><small>{tx("term")}</small><strong>{p.termDays === null ? tx("noTerm") : tx("days", { n: p.termDays })}</strong></div>
          {p.riskLabel && <div><small>{tx("risk")}</small><strong>{p.riskLabel}</strong></div>}
        </div>

        {p.howItWorks && <section className="pp-card"><h2><CircleHelp size={16} /> {tx("how")}</h2><p className="pp-text">{p.howItWorks}</p></section>}
        {p.riskDetails && <section className="pp-card"><h2><Lock size={16} /> {tx("risk")}</h2><p className="pp-text">{p.riskDetails}</p></section>}
        <section className="pp-card">
          <h2><Wallet size={16} /> {tx("payout")}</h2>
          <p className="pp-text">{p.payoutIntervalDays === 1 ? tx("payoutDaily") : tx("payoutBody", { n: p.payoutIntervalDays })}</p>
        </section>
        {p.inviteBoostX100 > 100 && (
          <section className="pp-card"><h2><Gift size={16} /> {tx("boost")}</h2><p className="pp-text">{tx("boostBody", { m: mult(p.inviteBoostX100) })}</p></section>
        )}

        {mine.length > 0 && (
          <section className="pp-card">
            <h2><PieChart size={16} /> {tx("myPlans")}</h2>
            {mine.map((s) => (
              <button key={s.id} type="button" className="pp-row" onClick={() => navigate(`/subscriptions/${s.id}`)}>
                <span>{m.fmt(s.amountMinor)} · {tx(`status_${s.status}`)}</span><ArrowRight size={16} />
              </button>
            ))}
          </section>
        )}

        <Gate w={w} />
        {open && canOperate(w) && (
          <div className="pp-invest">
            {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}
            <label className="field"><span>{tx("amount")}</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
            <p className="pp-note">{tx("available", { v: m.fmt(w.available) })}</p>
            <button type="button" className="primary-button" disabled={busy} onClick={() => void submit()}>{tx("invest")} <ArrowRight size={16} /></button>
          </div>
        )}
      </div>
    )
  }
}

/* ============================== os meus planos (lista) ============================== */

export function MyPlans() {
  const navigate = useNavigate()
  const { tx, language } = useTxt()
  const subs = useLoad(() => platformApi.subscriptions({ silent: true }), [])
  const list = (subs.data ?? []).filter((s) => s.status === "ACTIVE" || s.status === "PENDING" || s.status === "COMPLETED")
  if (list.length === 0) return null
  return (
    <section className="pp-card pp-mine">
      <h2><PieChart size={16} /> {tx("myPlans")}</h2>
      {list.map((s) => <MyPlanRow key={s.id} s={s} language={language} onOpen={() => navigate(`/subscriptions/${s.id}`)} />)}
    </section>
  )
}
function MyPlanRow({ s, language, onOpen }: { s: SubscriptionDto; language: string; onOpen: () => void }) {
  const { tx } = useTxt()
  const f = useFine(s.currency, language)
  return (
    <button type="button" className="pp-row" onClick={onOpen}>
      <span><b>{s.planName}</b><small>{f.fmt(s.amountMinor)} · {tx(`status_${s.status}`)}</small></span><ArrowRight size={16} />
    </button>
  )
}

/* ============================== painel do plano ============================== */

export function PlanPanelPage() {
  const { id = "" } = useParams()
  const [tick, setTick] = useState(0)
  const panel = useLoad(() => platformApi.panel(id), [id, tick])
  return (
    <Sub title={panel.data?.plan.name ?? ""}>
      <Load q={panel}>{(d) => <PanelBody key={`${d.subscription.id}:${tick}`} data={d} reload={() => setTick((n) => n + 1)} />}</Load>
    </Sub>
  )
}

const MAX_POINTS = 240
const POLL_MS = 5000

function PanelBody({ data, reload }: { data: SubscriptionPanelDto; reload: () => void }) {
  const navigate = useNavigate()
  const { tx, language } = useTxt()
  const err = useErr()
  const { subscription: sub, plan } = data
  const f = useFine(sub.currency, language)
  const [live, setLive] = useState<SubscriptionLiveDto>(data.live)
  const [points, setPoints] = useState<MarketPointDto[]>(data.live.market?.points ?? [])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const syncRef = useRef({ at: Date.now(), serverOffset: Date.parse(data.live.serverTime) - Date.now() })
  const lastT = useRef<string | null>(data.live.market?.points.at(-1)?.t ?? null)
  useTick(1000)

  const poll = useCallback(async () => {
    try {
      const next = await platformApi.live(sub.id, lastT.current)
      syncRef.current = { at: Date.now(), serverOffset: Date.parse(next.serverTime) - Date.now() }
      const fresh = next.market?.points ?? []
      if (fresh.length > 0) {
        lastT.current = fresh[fresh.length - 1]!.t
        setPoints((prev) => {
          const seen = new Set(prev.map((p) => p.t))
          return [...prev, ...fresh.filter((p) => !seen.has(p.t))].slice(-MAX_POINTS)
        })
      }
      setLive(next)
      if (next.status !== data.live.status) reload()
    } catch {
      // falha de rede ou sessão: mantém o último estado e tenta no ciclo seguinte
    }
  }, [sub.id, data.live.status, reload])

  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) void poll() }, POLL_MS)
    const onVisible = () => { if (!document.hidden) void poll() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible) }
  }, [poll])

  const elapsed = (Date.now() - syncRef.current.at) / 1000
  const active = live.status === "ACTIVE"
  // Visual: avança ao ritmo que o servidor indicou entre dois pedidos. Nada disto é usado para levantar.
  const shown = live.earnings.generatedMinor + (active ? (live.earnings.perDayMinor / 86400) * elapsed : 0)
  const remaining = live.remainingSeconds === null ? null : Math.max(0, live.remainingSeconds - elapsed)
  const serverNow = Date.now() + syncRef.current.serverOffset
  const untilClaim = live.payout.nextClaimAt ? (Date.parse(live.payout.nextClaimAt) - serverNow) / 1000 : null

  const claim = async () => {
    setMsg(null)
    try {
      const next = await platformApi.claimEarnings(sub.id)
      syncRef.current = { at: Date.now(), serverOffset: Date.parse(next.serverTime) - Date.now() }
      setLive(next)
      setMsg({ ok: true, text: tx("claimDone") })
    } catch (e) {
      setMsg({ ok: false, text: err(e) })
    }
  }

  const r = live.rate
  const gauge = r.maxBps > r.minBps ? Math.min(100, Math.max(0, ((r.currentBps - r.minBps) / (r.maxBps - r.minBps)) * 100)) : 100

  return (
    <div className="pp">
      <PlanArt plan={plan} />
      <div className="pp-title">
        <h1>{plan.name}</h1>
        <span className={`pp-chip ${STATUS_TONE[live.status] ?? ""}`}>{tx(`status_${live.status}`)}</span>
      </div>

      {live.status === "PENDING" && <div className="info-box" role="note"><Clock3 size={18} /><p>{tx("pendingNote")}</p></div>}
      {live.status === "COMPLETED" && <div className="info-box" role="status"><Check size={18} /><p>{tx("completedNote")}</p></div>}

      <div className="pp-grid">
        <div><small>{tx("invested")}</small><strong>{f.fmt(sub.amountMinor)}</strong></div>
        {active && remaining !== null && <div><small>{tx("remaining")}</small><strong>{span(remaining)}</strong>{sub.endsAt && <em>{tx("endsAt", { d: new Date(sub.endsAt).toLocaleDateString(language) })}</em>}</div>}
        {live.status === "COMPLETED" && <div><small>{tx("remaining")}</small><strong>{tx("ended")}</strong></div>}
      </div>

      {/* mercado em tempo real */}
      <section className="pp-card">
        <h2><TrendingUp size={16} /> {tx("live")}{live.market ? ` · ${live.market.label}` : ""}</h2>
        {live.market ? (
          <>
            <div className="pp-quote">
              <strong>{live.market.price === null ? "—" : live.market.price.toLocaleString(undefined, { maximumFractionDigits: 5 })}</strong>
              {live.market.changePct !== null && (
                <span className={live.market.changePct >= 0 ? "up" : "down"}>
                  {live.market.changePct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {live.market.changePct >= 0 ? "+" : ""}{live.market.changePct.toFixed(2)}%
                </span>
              )}
              <i className={`pp-dot ${live.market.stale ? "off" : "on"}`} aria-hidden="true" />
            </div>
            <LiveChart points={points} up={(live.market.changePct ?? 0) >= 0} waiting={tx("waiting")} />
            <p className="pp-note">{live.market.stale ? tx("rateStale") : tx("sourceNote")}</p>
          </>
        ) : (
          <p className="pp-note">{tx("noMarket")}</p>
        )}
      </section>

      {/* percentagem do plano */}
      <section className="pp-card">
        <h2><Sparkles size={16} /> {tx("rate")}</h2>
        <div className="pp-bigrate"><strong>{pct(r.currentBps)}</strong><span>{tx("perDay")}</span></div>
        {r.mode === "MARKET" && (
          <>
            <div className="pp-gauge" role="progressbar" aria-valuenow={Math.round(gauge)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${gauge}%` }} /></div>
            <div className="pp-gauge-l"><span>{tx("dailyMin")} {pct(r.minBps)}</span><span>{tx("dailyMax")} {pct(r.maxBps)}</span></div>
          </>
        )}
        {r.limit === "MAX" && <p className="pp-note ok">{tx("rateLimitMax")}</p>}
        {r.limit === "MIN" && <p className="pp-note">{tx("rateLimitMin")}</p>}
        {r.boostX100 > 100 && <p className="pp-note ok">{tx("rateEff")}: <b>{pct(r.effectiveBps)}</b> {tx("perDay")}</p>}
      </section>

      {/* bónus de convite */}
      {plan.inviteBoostX100 > 100 && (
        <section className="pp-card pp-boost">
          <h2><Gift size={16} /> {tx("boost")}</h2>
          <p className="pp-text">{data.boost.active ? tx("boostActive", { m: mult(data.boost.multiplierX100) }) : tx("boostInactive", { m: mult(plan.inviteBoostX100) })}</p>
          <p className="pp-note">{tx("invitees", { n: data.boost.qualifiedInvitees })}</p>
          {!data.boost.active && <button type="button" className="small-button" onClick={() => navigate("/invite")}>{tx("invite")}</button>}
        </section>
      )}

      {/* comissão */}
      <section className="pp-card">
        <h2><Wallet size={16} /> {tx("generated")}</h2>
        <div className="pp-total">{f.fine(shown)}</div>
        <div className="pp-grid pp-grid--3">
          <div><small>{tx("lastMinute")}</small><strong>{f.fine(live.earnings.lastMinuteMinor)}</strong></div>
          <div><small>{tx("lastHour")}</small><strong>{f.fine(live.earnings.lastHourMinor)}</strong></div>
          <div><small>{tx("lastDay")}</small><strong>{f.fine(live.earnings.lastDayMinor)}</strong></div>
        </div>
        {active && (
          <div className="pp-grid pp-grid--3">
            <div><small>{tx("pace")}</small><strong>{f.fine(live.earnings.perMinuteMinor)}</strong><em>{tx("perMinute")}</em></div>
            <div><small>&nbsp;</small><strong>{f.fine(live.earnings.perHourMinor)}</strong><em>{tx("perHour")}</em></div>
            <div><small>&nbsp;</small><strong>{f.fine(live.earnings.perDayMinor)}</strong><em>{tx("perDayL")}</em></div>
          </div>
        )}
        <div className="pp-grid">
          <div><small>{tx("claimed")}</small><strong>{f.fmt(live.earnings.claimedMinor)}</strong></div>
          <div><small>{tx("claimable")}</small><strong>{f.fmt(live.earnings.claimableMinor)}</strong></div>
        </div>
      </section>

      <EarningsSeries id={sub.id} active={active || live.status === "COMPLETED"} tx={tx} fine={f.fine} />

      {/* levantar para a carteira */}
      {active && (
        <section className="pp-card">
          <h2><Wallet size={16} /> {tx("payout")}</h2>
          <p className="pp-note">{live.payout.intervalDays === 1 ? tx("payoutDaily") : tx("payoutBody", { n: live.payout.intervalDays })} {tx("destination")}.</p>
          {msg && <div className={`info-box ${msg.ok ? "" : "bad"}`} role={msg.ok ? "status" : "alert"}>{msg.ok ? <Check size={18} /> : <CircleHelp size={18} />}<p>{msg.text}</p></div>}
          <button type="button" className="primary-button" disabled={!live.payout.canClaim} onClick={() => void claim()}>{tx("claim")} · {f.fmt(live.earnings.claimableMinor)}</button>
          {!live.payout.canClaim && untilClaim !== null && untilClaim > 0 && <p className="pp-note">{tx("nextClaim", { t: span(untilClaim) })}</p>}
          {!live.payout.canClaim && (untilClaim === null || untilClaim <= 0) && live.earnings.claimableMinor < 1 && <p className="pp-note">{tx("nothing")}</p>}
        </section>
      )}

      <section className="pp-card">
        <h2><Layers size={16} /> {tx("history")}</h2>
        {data.payouts.length === 0 ? <p className="pp-note">{tx("noPayouts")}</p> : data.payouts.map((p) => (
          <div key={p.id} className="pp-pay"><span>{new Date(p.createdAt).toLocaleString(language)}<small>{tx(p.kind === "CLAIM" ? "kindClaim" : "kindExpiry")}</small></span><b>+{f.fmt(p.amountMinor)}</b></div>
        ))}
      </section>
    </div>
  )
}

/* ---------- gráfico do mercado (SVG, sem bibliotecas) ---------- */
function LiveChart({ points, up, waiting }: { points: MarketPointDto[]; up: boolean; waiting: string }) {
  const n = points.length
  if (n < 2) return <div className="pp-chart pp-chart--empty">{waiting}</div>
  const W = 320, H = 170, L = 6, R = 46, T = 10, B = 18
  const prices = points.map((p) => p.price)
  let lo = Math.min(...prices), hi = Math.max(...prices)
  if (hi === lo) { hi += Math.abs(hi) * 0.0005 || 1; lo -= Math.abs(lo) * 0.0005 || 1 }
  const pad = (hi - lo) * 0.12
  lo -= pad; hi += pad
  const x = (i: number) => L + (i * (W - L - R)) / (n - 1)
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo))
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`).join(" ")
  const area = `${line} L${x(n - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`
  const ticks = [hi - pad, (hi + lo) / 2, lo + pad]
  const lastX = x(n - 1), lastY = y(points[n - 1]!.price)
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return (
    <figure className={`pp-chart ${up ? "up" : "down"}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="market">
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="pp-grid-l" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="pp-axis" x={W - R + 4} y={y(t) + 3}>{t.toLocaleString(undefined, { maximumFractionDigits: 4 })}</text>
          </g>
        ))}
        <path className="pp-area" d={area} />
        <path className="pp-line" d={line} />
        <circle className="pp-pulse" cx={lastX} cy={lastY} r="4" />
        <circle className="pp-last" cx={lastX} cy={lastY} r="3" />
        <text className="pp-axis" x={L} y={H - 4}>{time(points[0]!.t)}</text>
        <text className="pp-axis" x={W - R} y={H - 4} textAnchor="end">{time(points[n - 1]!.t)}</text>
      </svg>
    </figure>
  )
}

/* ---------- comissão gerada por minuto / hora / dia ---------- */
function EarningsSeries({ id, active, tx, fine }: { id: string; active: boolean; tx: Tx; fine: (minor: number) => string }) {
  const [bucket, setBucket] = useState<SeriesBucket>("hour")
  const [data, setData] = useState<EarningsSeriesDto | null>(null)
  useEffect(() => {
    if (!active) return
    let live = true
    const load = () => { platformApi.earningsSeries(id, bucket).then((d) => { if (live) setData(d) }, () => undefined) }
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, 30_000)
    return () => { live = false; clearInterval(t) }
  }, [id, bucket, active])
  if (!active) return null
  const pts = data?.points ?? []
  const max = Math.max(1e-9, ...pts.map((p) => p.amountMinor))
  const label = (iso: string) => {
    const d = new Date(iso)
    return bucket === "day" ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  return (
    <section className="pp-card">
      <h2><PieChart size={16} /> {tx("seriesTitle")}</h2>
      <div className="segmented" role="tablist">
        {(["minute", "hour", "day"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={bucket === k} className={bucket === k ? "active" : ""} onClick={() => setBucket(k)}>{tx(k)}</button>
        ))}
      </div>
      {pts.length === 0 ? <div className="pp-chart pp-chart--empty">{tx("waiting")}</div> : (
        <figure className="pp-bars">
          <div className="pp-bars-row" aria-hidden="true">
            {pts.map((p) => <i key={p.t} title={`${label(p.t)} · ${fine(p.amountMinor)}`} style={{ height: `${Math.max(2, (p.amountMinor / max) * 100)}%` }} />)}
          </div>
          <div className="pp-bars-axis"><span>{label(pts[0]!.t)}</span><span>{fine(max)}</span><span>{label(pts[pts.length - 1]!.t)}</span></div>
        </figure>
      )}
    </section>
  )
}
