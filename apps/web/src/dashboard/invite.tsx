import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BadgeCheck, Check, CheckCircle2, Copy, Crown, Gift, Lock, MessageCircle, Share2, ShieldCheck, Sparkles, TrendingUp, UserPlus, Users, Wallet } from "lucide-react"
import type { ReferralInviteDto, ReferralLevelDto, ReferralOverviewDto, ReferralSeriesPoint } from "@kivora/shared"
import { useI18n } from "../i18n/I18nProvider.js"
import { ApiError, platformApi } from "../services/api-client.js"
import { Header, Page } from "./App.js"
import { makeMoney } from "./deposit-flow.js"
import "./invite.css"

/*
 * Convidar e ganhar. Tudo o que aparece aqui vem do servidor (GET /referrals/me): contagens, níveis, ganhos,
 * identificadores dos convidados e o código do link. O frontend não calcula comissões nem níveis.
 */
type Txt = Record<string, string>
const TEXT: Record<string, Txt> = {
  pt: {
    title: "Convidar e ganhar", ctaTitle: "Convide amigos e ganhe", ctaBody: "Veja o seu link, os seus convidados, o seu nível e os seus ganhos.", ctaButton: "Abrir painel",
    heroTitle: "Faça a sua comunidade crescer", heroBody: "Partilhe o seu link. Quando um convidado verificar a conta, depositar e assinar um plano, você ganha.",
    linkLabel: "O seu link de convite", copy: "Copiar", copied: "Copiado", share: "Partilhar", whatsapp: "WhatsApp", shareText: "Junte-se à KIVORA:",
    funnel: "O seu funil de convites", registered: "Registados", emailVerified: "Email verificado", kycVerified: "Conta verificada", funded: "Depositaram", subscribed: "Com plano", earned: "Ganhos",
    chart: "Crescimento da comunidade", chartSub: "Últimos 30 dias, acumulado",
    unlockTitle: "Desbloqueie os seus ganhos", unlockBody: "Precisa de {n} convidados com depósito para começar a receber.", unlocked: "Ganhos desbloqueados", of: "{a} de {b}",
    levelTitle: "O seu nível", noLevel: "Ainda sem nível", level: "Nível {n}", bonus: "+{p}% no rendimento do seu plano", noBonus: "Bónus definido pela administração",
    next: "Faltam {n} convidados com depósito para {name}", top: "Nível máximo alcançado", levels: "Níveis da comunidade", needs: "{n} com depósito",
    commissionTitle: "Comissão por convite", commissionBody: "Por cada convidado verificado que assina um plano, recebe {v}.", commissionUnset: "A comissão por convite é definida pela administração.",
    paid: "Já recebido", pending: "A receber", pendingHint: "Convites qualificados à espera de desbloqueio ou de pagamento.",
    how: "Como funciona", s1: "Partilhe o seu link", s2: "O amigo regista-se e verifica a conta", s3: "Ele deposita e assina um plano: você ganha e o seu nível sobe",
    invites: "Os seus convidados", empty: "Ainda sem convidados. Partilhe o link para começar.", joined: "Entrou em {d}", review: "Em análise", commission: "Comissão",
    cEmail: "Email", cKyc: "Conta", cFunded: "Depósito", cPlan: "Plano",
    rules: "Cada pessoa só pode ter uma conta, com um email. Contas repetidas ou suspeitas são retidas e analisadas, e não contam.", retry: "Tentar novamente", error: "Não foi possível carregar o painel.", off: "Os convites estão temporariamente desligados.",
  },
  en: {
    title: "Invite and earn", ctaTitle: "Invite friends and earn", ctaBody: "See your link, your invitees, your level and your earnings.", ctaButton: "Open dashboard",
    heroTitle: "Grow your community", heroBody: "Share your link. When an invitee verifies their account, deposits and subscribes to a plan, you earn.",
    linkLabel: "Your invite link", copy: "Copy", copied: "Copied", share: "Share", whatsapp: "WhatsApp", shareText: "Join KIVORA:",
    funnel: "Your invite funnel", registered: "Signed up", emailVerified: "Email verified", kycVerified: "Account verified", funded: "Deposited", subscribed: "On a plan", earned: "Earned",
    chart: "Community growth", chartSub: "Last 30 days, cumulative",
    unlockTitle: "Unlock your earnings", unlockBody: "You need {n} invitees with a deposit to start earning.", unlocked: "Earnings unlocked", of: "{a} of {b}",
    levelTitle: "Your level", noLevel: "No level yet", level: "Level {n}", bonus: "+{p}% on your plan's yield", noBonus: "Bonus set by the administration",
    next: "{n} more invitees with a deposit to reach {name}", top: "Top level reached", levels: "Community levels", needs: "{n} with a deposit",
    commissionTitle: "Commission per invite", commissionBody: "For every verified invitee who subscribes to a plan, you receive {v}.", commissionUnset: "The commission per invite is set by the administration.",
    paid: "Received", pending: "Pending", pendingHint: "Qualified invites waiting for unlock or payment.",
    how: "How it works", s1: "Share your link", s2: "Your friend signs up and verifies their account", s3: "They deposit and subscribe to a plan: you earn and your level goes up",
    invites: "Your invitees", empty: "No invitees yet. Share your link to get started.", joined: "Joined {d}", review: "Under review", commission: "Commission",
    cEmail: "Email", cKyc: "Account", cFunded: "Deposit", cPlan: "Plan",
    rules: "Each person may have one account with one email. Duplicate or suspicious accounts are held for review and do not count.", retry: "Try again", error: "Could not load the dashboard.", off: "Invitations are temporarily turned off.",
  },
  es: {
    title: "Invitar y ganar", ctaTitle: "Invita a amigos y gana", ctaBody: "Mira tu enlace, tus invitados, tu nivel y tus ganancias.", ctaButton: "Abrir panel",
    heroTitle: "Haz crecer tu comunidad", heroBody: "Comparte tu enlace. Cuando un invitado verifique su cuenta, deposite y contrate un plan, tú ganas.",
    linkLabel: "Tu enlace de invitación", copy: "Copiar", copied: "Copiado", share: "Compartir", whatsapp: "WhatsApp", shareText: "Únete a KIVORA:",
    funnel: "Tu embudo de invitaciones", registered: "Registrados", emailVerified: "Email verificado", kycVerified: "Cuenta verificada", funded: "Depositaron", subscribed: "Con plan", earned: "Ganancias",
    chart: "Crecimiento de la comunidad", chartSub: "Últimos 30 días, acumulado",
    unlockTitle: "Desbloquea tus ganancias", unlockBody: "Necesitas {n} invitados con depósito para empezar a ganar.", unlocked: "Ganancias desbloqueadas", of: "{a} de {b}",
    levelTitle: "Tu nivel", noLevel: "Aún sin nivel", level: "Nivel {n}", bonus: "+{p}% en el rendimiento de tu plan", noBonus: "Bono definido por la administración",
    next: "Faltan {n} invitados con depósito para {name}", top: "Nivel máximo alcanzado", levels: "Niveles de la comunidad", needs: "{n} con depósito",
    commissionTitle: "Comisión por invitación", commissionBody: "Por cada invitado verificado que contrata un plan, recibes {v}.", commissionUnset: "La comisión por invitación la define la administración.",
    paid: "Recibido", pending: "Pendiente", pendingHint: "Invitaciones cualificadas a la espera de desbloqueo o pago.",
    how: "Cómo funciona", s1: "Comparte tu enlace", s2: "Tu amigo se registra y verifica su cuenta", s3: "Deposita y contrata un plan: tú ganas y sube tu nivel",
    invites: "Tus invitados", empty: "Aún no hay invitados. Comparte el enlace para empezar.", joined: "Se unió el {d}", review: "En revisión", commission: "Comisión",
    cEmail: "Email", cKyc: "Cuenta", cFunded: "Depósito", cPlan: "Plan",
    rules: "Cada persona solo puede tener una cuenta, con un email. Las cuentas repetidas o sospechosas se retienen para revisión y no cuentan.", retry: "Reintentar", error: "No se pudo cargar el panel.", off: "Las invitaciones están desactivadas temporalmente.",
  },
  fr: {
    title: "Inviter et gagner", ctaTitle: "Invitez vos amis et gagnez", ctaBody: "Voyez votre lien, vos invités, votre niveau et vos gains.", ctaButton: "Ouvrir le tableau",
    heroTitle: "Faites grandir votre communauté", heroBody: "Partagez votre lien. Quand un invité vérifie son compte, dépose et souscrit à un plan, vous gagnez.",
    linkLabel: "Votre lien d’invitation", copy: "Copier", copied: "Copié", share: "Partager", whatsapp: "WhatsApp", shareText: "Rejoignez KIVORA :",
    funnel: "Votre entonnoir d’invitations", registered: "Inscrits", emailVerified: "Email vérifié", kycVerified: "Compte vérifié", funded: "Ont déposé", subscribed: "Avec un plan", earned: "Gains",
    chart: "Croissance de la communauté", chartSub: "30 derniers jours, cumulé",
    unlockTitle: "Débloquez vos gains", unlockBody: "Il faut {n} invités avec un dépôt pour commencer à gagner.", unlocked: "Gains débloqués", of: "{a} sur {b}",
    levelTitle: "Votre niveau", noLevel: "Pas encore de niveau", level: "Niveau {n}", bonus: "+{p}% sur le rendement de votre plan", noBonus: "Bonus défini par l’administration",
    next: "Il manque {n} invités avec un dépôt pour {name}", top: "Niveau maximal atteint", levels: "Niveaux de la communauté", needs: "{n} avec dépôt",
    commissionTitle: "Commission par invitation", commissionBody: "Pour chaque invité vérifié qui souscrit à un plan, vous recevez {v}.", commissionUnset: "La commission par invitation est définie par l’administration.",
    paid: "Reçu", pending: "En attente", pendingHint: "Invitations qualifiées en attente de déblocage ou de paiement.",
    how: "Comment ça marche", s1: "Partagez votre lien", s2: "Votre ami s’inscrit et vérifie son compte", s3: "Il dépose et souscrit à un plan : vous gagnez et votre niveau monte",
    invites: "Vos invités", empty: "Pas encore d’invités. Partagez votre lien pour commencer.", joined: "Inscrit le {d}", review: "En examen", commission: "Commission",
    cEmail: "Email", cKyc: "Compte", cFunded: "Dépôt", cPlan: "Plan",
    rules: "Chaque personne ne peut avoir qu’un compte, avec un email. Les comptes en double ou suspects sont retenus pour examen et ne comptent pas.", retry: "Réessayer", error: "Impossible de charger le tableau.", off: "Les invitations sont temporairement désactivées.",
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

/* ---------- cartão do início: só leva ao painel (o link verdadeiro vem do servidor) ---------- */
export function InviteCard() {
  const navigate = useNavigate()
  const { tx } = useTxt()
  return (
    <section className="invite-card iv-cta" aria-label={tx("ctaTitle")}>
      <div className="invite-head">
        <span className="invite-icon" aria-hidden="true"><Gift size={20} /></span>
        <h3>{tx("ctaTitle")}</h3>
      </div>
      <p>{tx("ctaBody")}</p>
      <button type="button" className="primary-button" onClick={() => navigate("/invite")}><Sparkles size={16} /> {tx("ctaButton")}</button>
    </section>
  )
}

/* ---------- gráfico (SVG, sem bibliotecas) ---------- */
function GrowthChart({ series, labels }: { series: ReferralSeriesPoint[]; labels: { registered: string; funded: string; subscribed: string; title: string } }) {
  const n = series.length
  if (n === 0) return null
  const W = 320, H = 156, L = 28, R = 8, T = 10, B = 22
  const max = Math.max(1, ...series.map((p) => Math.max(p.registered, p.funded, p.subscribed)))
  const x = (i: number) => L + (n <= 1 ? 0 : (i * (W - L - R)) / (n - 1))
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const line = (k: "registered" | "funded" | "subscribed") => series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(" ")
  const area = `${line("registered")} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`
  const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const last = series[n - 1]!
  return (
    <figure className="iv-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${labels.title}: ${labels.registered} ${last.registered}, ${labels.funded} ${last.funded}, ${labels.subscribed} ${last.subscribed}`}>
        {[0, 0.5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className="iv-grid" />)}
        <text x={L - 4} y={y(max) + 3} className="iv-axis" textAnchor="end">{max}</text>
        <text x={L - 4} y={y(0) + 3} className="iv-axis" textAnchor="end">0</text>
        <text x={L} y={H - 6} className="iv-axis">{d(series[0]!.date)}</text>
        <text x={W - R} y={H - 6} className="iv-axis" textAnchor="end">{d(last.date)}</text>
        <path d={area} className="iv-area" />
        <path d={line("registered")} className="iv-line iv-line--reg" />
        <path d={line("funded")} className="iv-line iv-line--fund" />
        <path d={line("subscribed")} className="iv-line iv-line--sub" />
        <circle cx={x(n - 1)} cy={y(last.registered)} r="3.2" className="iv-dot iv-dot--reg" />
        <circle cx={x(n - 1)} cy={y(last.funded)} r="3.2" className="iv-dot iv-dot--fund" />
        <circle cx={x(n - 1)} cy={y(last.subscribed)} r="3.2" className="iv-dot iv-dot--sub" />
      </svg>
      <figcaption className="iv-legend">
        <span><i className="iv-key iv-key--reg" />{labels.registered} <b>{last.registered}</b></span>
        <span><i className="iv-key iv-key--fund" />{labels.funded} <b>{last.funded}</b></span>
        <span><i className="iv-key iv-key--sub" />{labels.subscribed} <b>{last.subscribed}</b></span>
      </figcaption>
    </figure>
  )
}

function Step({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`iv-chip ${ok ? "is-on" : ""}`}>{ok ? <Check size={12} aria-hidden="true" /> : <span className="iv-chip-dot" aria-hidden="true" />}{label}</span>
}

function LevelRow({ l, funded, current, tx }: { l: ReferralLevelDto; funded: number; current: boolean; tx: ReturnType<typeof useTxt>["tx"] }) {
  const reached = funded >= l.minFunded
  return (
    <li className={`iv-level ${reached ? "is-reached" : ""} ${current ? "is-current" : ""}`}>
      <span className="iv-level-ico" aria-hidden="true">{reached ? <Crown size={16} /> : <Lock size={15} />}</span>
      <div><strong>{l.name}</strong><small>{tx("needs", { n: l.minFunded })}</small></div>
      <b>{l.yieldBonusBps > 0 ? `+${l.yieldBonusBps / 100}%` : "—"}</b>
    </li>
  )
}

/* ---------- página do painel ---------- */
export function InvitePage() {
  const { tx, language } = useTxt()
  const [data, setData] = useState<ReferralOverviewDto | null>(null)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    setFailed(false)
    platformApi.referrals().then((d) => { if (live) setData(d) }, (e: unknown) => { if (live) { setFailed(true); if (!(e instanceof ApiError)) setData(null) } })
    return () => { live = false }
  }, [tick])

  const link = data ? `${window.location.origin}${data.path}` : ""
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { /* o utilizador pode copiar o campo à mão */ }
  }
  async function share() {
    if (typeof navigator.share === "function") { try { await navigator.share({ title: "KIVORA", text: tx("shareText"), url: link }) } catch { /* cancelado */ } return }
    await copy()
  }

  if (!data) {
    return (
      <Page>
        <Header title={tx("title")} back />
        {failed ? <div className="info-box" role="alert"><p>{tx("error")}</p><button className="text-button" onClick={() => setTick((n) => n + 1)}>{tx("retry")}</button></div> : null}
      </Page>
    )
  }

  const m = makeMoney(data.currency)
  const { totals: t, earnings: e, unlock: u, level: lv } = data
  const funnel: [string, number, typeof Users][] = [
    [tx("registered"), t.registered, Users], [tx("emailVerified"), t.emailVerified, BadgeCheck], [tx("kycVerified"), t.kycVerified, ShieldCheck],
    [tx("funded"), t.funded, Wallet], [tx("subscribed"), t.subscribed, CheckCircle2],
  ]
  const toNext = lv.next ? Math.max(0, lv.next.minFunded - lv.funded) : 0
  const base = lv.current?.minFunded ?? 0
  const levelPct = lv.next ? Math.min(100, Math.round(((lv.funded - base) / Math.max(1, lv.next.minFunded - base)) * 100)) : 100
  const unlockPct = Math.min(100, Math.round((u.funded / Math.max(1, u.required)) * 100))
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(language === "pt" ? "pt-AO" : language)

  return (
    <Page className="iv-page">
      <Header title={tx("title")} back />

      <section className="iv-hero">
        <span className="iv-hero-ico" aria-hidden="true"><UserPlus size={22} /></span>
        <h1>{tx("heroTitle")}</h1>
        <p>{tx("heroBody")}</p>
        {data.enabled ? (
          <>
            <label className="iv-linklabel" htmlFor="iv-link">{tx("linkLabel")}</label>
            <input id="iv-link" className="invite-link" readOnly value={link} onFocus={(ev) => ev.currentTarget.select()} />
            <div className="iv-actions">
              <button type="button" className="secondary-button" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? tx("copied") : tx("copy")}</button>
              <a className="secondary-button" href={`https://wa.me/?text=${encodeURIComponent(`${tx("shareText")} ${link}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> {tx("whatsapp")}</a>
              <button type="button" className="primary-button" onClick={() => void share()}><Share2 size={16} /> {tx("share")}</button>
            </div>
          </>
        ) : <p className="iv-off">{tx("off")}</p>}
      </section>

      <section className="iv-card" aria-label={tx("funnel")}>
        <h2><TrendingUp size={16} /> {tx("funnel")}</h2>
        <ol className="iv-funnel">
          {funnel.map(([label, value, Icon]) => (
            <li key={label}>
              <span className="iv-funnel-ico" aria-hidden="true"><Icon size={16} /></span>
              <span className="iv-funnel-label">{label}</span>
              <b>{value}</b>
              <i className="iv-bar" style={{ width: `${t.registered > 0 ? Math.round((value / t.registered) * 100) : 0}%` }} aria-hidden="true" />
            </li>
          ))}
        </ol>
        <div className="iv-earn">
          <div><small>{tx("paid")}</small><strong>{m.fmt(e.paidMinor)}</strong></div>
          <div><small>{tx("pending")}</small><strong>{m.fmt(e.pendingMinor)}</strong></div>
        </div>
        <p className="iv-note">{e.perInviteMinor > 0 ? tx("commissionBody", { v: m.fmt(e.perInviteMinor) }) : tx("commissionUnset")}</p>
      </section>

      <section className="iv-card" aria-label={tx("chart")}>
        <h2><TrendingUp size={16} /> {tx("chart")}</h2>
        <p className="iv-note">{tx("chartSub")}</p>
        <GrowthChart series={data.series} labels={{ title: tx("chart"), registered: tx("registered"), funded: tx("funded"), subscribed: tx("subscribed") }} />
      </section>

      <section className={`iv-card iv-unlock ${u.unlocked ? "is-open" : ""}`} aria-label={tx("unlockTitle")}>
        <h2>{u.unlocked ? <CheckCircle2 size={16} /> : <Lock size={16} />} {u.unlocked ? tx("unlocked") : tx("unlockTitle")}</h2>
        {u.unlocked ? null : <p className="iv-note">{tx("unlockBody", { n: u.required })}</p>}
        <div className="iv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={u.required} aria-valuenow={Math.min(u.funded, u.required)}><i style={{ width: `${unlockPct}%` }} /></div>
        <small className="iv-note">{tx("of", { a: Math.min(u.funded, u.required), b: u.required })}</small>
      </section>

      <section className="iv-card" aria-label={tx("levelTitle")}>
        <h2><Crown size={16} /> {tx("levelTitle")}</h2>
        <div className="iv-level-now">
          <strong>{lv.current ? `${tx("level", { n: lv.current.level })} · ${lv.current.name}` : tx("noLevel")}</strong>
          <span>{lv.current && lv.current.yieldBonusBps > 0 ? tx("bonus", { p: lv.current.yieldBonusBps / 100 }) : tx("noBonus")}</span>
        </div>
        <div className="iv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelPct}><i style={{ width: `${levelPct}%` }} /></div>
        <small className="iv-note">{lv.next ? tx("next", { n: toNext, name: lv.next.name }) : data.levels.length > 0 ? tx("top") : ""}</small>
        {data.levels.length > 0 ? <ul className="iv-levels" aria-label={tx("levels")}>{data.levels.map((l) => <LevelRow key={l.level} l={l} funded={lv.funded} current={lv.current?.level === l.level} tx={tx} />)}</ul> : null}
      </section>

      <section className="iv-card" aria-label={tx("how")}>
        <h2><Sparkles size={16} /> {tx("how")}</h2>
        <ol className="iv-steps"><li>{tx("s1")}</li><li>{tx("s2")}</li><li>{tx("s3")}</li></ol>
      </section>

      <section className="iv-card" aria-label={tx("invites")}>
        <h2><Users size={16} /> {tx("invites")} <span className="iv-count">{t.registered}</span></h2>
        {data.invites.length === 0 ? <p className="iv-empty">{tx("empty")}</p> : (
          <ul className="iv-invites">
            {data.invites.map((i: ReferralInviteDto) => (
              <li key={i.memberCode}>
                <div className="iv-inv-head"><strong>{i.memberCode}</strong><small>{tx("joined", { d: dateFmt(i.joinedAt) })}</small></div>
                <div className="iv-chips">
                  <Step ok={i.emailVerified} label={tx("cEmail")} /><Step ok={i.kycVerified} label={tx("cKyc")} /><Step ok={i.funded} label={tx("cFunded")} /><Step ok={i.subscribed} label={tx("cPlan")} />
                </div>
                {i.inReview ? <span className="iv-review">{tx("review")}</span> : null}
                {i.commissionMinor !== null ? <b className="iv-comm">+{m.fmt(i.commissionMinor)}</b> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="iv-rules"><ShieldCheck size={14} /> {tx("rules")}</p>
    </Page>
  )
}
