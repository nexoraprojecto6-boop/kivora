import { useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check, ChevronLeft, CircleHelp, Landmark } from "lucide-react"
import type { PaymentAccountDto, PaymentMethodDto, WalletDto } from "@kivora/shared"
import { useNavigate } from "react-router-dom"
import { useI18n } from "../i18n/I18nProvider.js"
import { platformApi } from "../services/api-client.js"
import { withLoader } from "../services/loader-store.js"
import { BrandIcon, type BrandId } from "./bank-icons.js"
import { EASE } from "./motion-kit.js"
import { Gate, Load, Sub, canOperate, makeMoney, newKey, useErr, useLoad, useS, useWallet } from "./screens.js"
import "./withdraw-flow.css"

/*
 * Levantamento em passos curtos:  1 Valor  ->  2 Destino  ->  3 Confirmar.
 * Se o cliente só tem um destino possível, o passo 2 desaparece e ficam 2 passos.
 * As regras e a chamada à API são as mesmas de antes (valor, mínimo/máximo do método, saldo, conta guardada).
 */

type Txt = Record<string, string>
const TEXT: Record<string, Txt> = {
  pt: {
    stepOf: "Passo {n} de {t}", amount: "Valor", dest: "Destino", confirm: "Confirmar", howMuch: "Quanto quer levantar?", whereTo: "Para onde enviamos?", review: "Confira e confirme",
    available: "Disponível", all: "Tudo", next: "Continuar", back: "Voltar", send: "Confirmar levantamento", sending: "A enviar o pedido",
    savedAccounts: "As suas contas", otherMethods: "Outros métodos", account: "Conta ou carteira de destino", amountLbl: "Valor", to: "Para", fee: "Taxa", min: "Mínimo", max: "Máximo",
    pendingNote: "O pedido fica pendente até ser aprovado pela equipa. Pode acompanhar no histórico.",
    doneTitle: "Pedido enviado", doneText: "O seu levantamento está pendente de aprovação.", reference: "Referência", status: "Estado", pending: "Pendente", history: "Ver histórico", home: "Ir para o início",
    noAccount: "Ainda não tem uma conta guardada. Faça primeiro um depósito para guardar a conta de onde vai levantar.", goDeposit: "Fazer um depósito",
    invested: "O valor investido em planos não está disponível para levantar.",
  },
  en: {
    stepOf: "Step {n} of {t}", amount: "Amount", dest: "Destination", confirm: "Confirm", howMuch: "How much do you want to withdraw?", whereTo: "Where should we send it?", review: "Review and confirm",
    available: "Available", all: "All", next: "Continue", back: "Back", send: "Confirm withdrawal", sending: "Sending your request",
    savedAccounts: "Your accounts", otherMethods: "Other methods", account: "Destination account or wallet", amountLbl: "Amount", to: "To", fee: "Fee", min: "Minimum", max: "Maximum",
    pendingNote: "The request stays pending until the team approves it. You can follow it in your history.",
    doneTitle: "Request sent", doneText: "Your withdrawal is pending approval.", reference: "Reference", status: "Status", pending: "Pending", history: "See history", home: "Go to home",
    noAccount: "You don't have a saved account yet. Make a deposit first to save the account you will withdraw to.", goDeposit: "Make a deposit",
    invested: "Money invested in plans isn't available to withdraw.",
  },
  es: {
    stepOf: "Paso {n} de {t}", amount: "Importe", dest: "Destino", confirm: "Confirmar", howMuch: "¿Cuánto quiere retirar?", whereTo: "¿Adónde lo enviamos?", review: "Revise y confirme",
    available: "Disponible", all: "Todo", next: "Continuar", back: "Volver", send: "Confirmar retiro", sending: "Enviando la solicitud",
    savedAccounts: "Sus cuentas", otherMethods: "Otros métodos", account: "Cuenta o cartera de destino", amountLbl: "Importe", to: "Para", fee: "Comisión", min: "Mínimo", max: "Máximo",
    pendingNote: "La solicitud queda pendiente hasta que el equipo la apruebe. Puede seguirla en el historial.",
    doneTitle: "Solicitud enviada", doneText: "Su retiro está pendiente de aprobación.", reference: "Referencia", status: "Estado", pending: "Pendiente", history: "Ver historial", home: "Ir al inicio",
    noAccount: "Aún no tiene una cuenta guardada. Haga primero un depósito para guardar la cuenta desde la que retirará.", goDeposit: "Hacer un depósito",
    invested: "El dinero invertido en planes no está disponible para retirar.",
  },
  fr: {
    stepOf: "Étape {n} sur {t}", amount: "Montant", dest: "Destination", confirm: "Confirmer", howMuch: "Combien voulez-vous retirer ?", whereTo: "Où l’envoyer ?", review: "Vérifiez et confirmez",
    available: "Disponible", all: "Tout", next: "Continuer", back: "Retour", send: "Confirmer le retrait", sending: "Envoi de la demande",
    savedAccounts: "Vos comptes", otherMethods: "Autres méthodes", account: "Compte ou portefeuille de destination", amountLbl: "Montant", to: "Vers", fee: "Frais", min: "Minimum", max: "Maximum",
    pendingNote: "La demande reste en attente jusqu’à son approbation par l’équipe. Suivez-la dans l’historique.",
    doneTitle: "Demande envoyée", doneText: "Votre retrait est en attente d’approbation.", reference: "Référence", status: "Statut", pending: "En attente", history: "Voir l’historique", home: "Aller à l’accueil",
    noAccount: "Vous n’avez pas encore de compte enregistré. Faites d’abord un dépôt pour enregistrer le compte de retrait.", goDeposit: "Faire un dépôt",
    invested: "L’argent investi dans des plans n’est pas disponible au retrait.",
  },
}

const RAILS = ["PAYPAY", "KWIK", "EXPRESS"]
const railName = (r: string) => (r === "PAYPAY" ? "PayPay" : r === "KWIK" ? "Kwik" : r === "EXPRESS" ? "Express" : r)
const railBrand = (r: string): BrandId | null => (r === "PAYPAY" ? "paypay" : r === "KWIK" ? "kwik" : r === "EXPRESS" ? "express" : null)
const mask = (d: string) => (d.length > 4 ? `•••• ${d.slice(-4)}` : d)

export function WithdrawPage() {
  const { t } = useI18n()
  const wallet = useWallet()
  const methods = useLoad(() => platformApi.methods("WITHDRAWAL"), [])
  const accounts = useLoad(() => platformApi.paymentAccounts(), [])
  return (
    <Sub title={t("dash.nav.withdrawals")} className="wd-page">
      <Load q={wallet}>{(w) => (
        <Load q={methods}>{(list) => <Load q={accounts}>{(saved) => <Wizard w={w} list={list} saved={saved} />}</Load>}</Load>
      )}</Load>
    </Sub>
  )
}

function Wizard({ w, list, saved }: { w: WalletDto; list: PaymentMethodDto[]; saved: PaymentAccountDto[] }) {
  const { language } = useI18n()
  const s = useS()
  const err = useErr()
  const navigate = useNavigate()
  const tx = (key: string, p: Record<string, string | number> = {}): string =>
    Object.entries(p).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), (TEXT[language] ?? TEXT["pt"]!)[key] ?? TEXT["pt"]![key] ?? key)
  const m = useMemo(() => makeMoney(language, w.currency), [language, w.currency])
  const nf = useMemo(() => new Intl.NumberFormat(language === "pt" ? "pt-AO" : language, { style: "currency", currency: w.currency }), [language, w.currency])
  const factor = 10 ** (nf.resolvedOptions().maximumFractionDigits ?? 2)
  const symbol = nf.formatToParts(0).find((p) => p.type === "currency")?.value ?? w.currency

  const [amount, setAmount] = useState("")
  const [accountId, setAccountId] = useState("")
  const [methodId, setMethodId] = useState("")
  const [destination, setDestination] = useState("")
  const [step, setStep] = useState(1)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ reference: string } | null>(null)
  const key = useRef(newKey())

  const others = list.filter((x) => !(x.rail && RAILS.includes(x.rail)))
  const onlyOne = saved.length + others.length === 1
  const effAccountId = accountId || (onlyOne && saved[0] ? saved[0].id : "")
  const effMethodId = methodId || (onlyOne && !saved[0] && others[0] ? others[0].id : "")
  const account = saved.find((a) => a.id === effAccountId)
  const method = account ? (list.find((x) => x.rail === account.rail) ?? null) : (others.find((x) => x.id === effMethodId) ?? null)
  const needsDest = !account && !!method
  const skipDest = onlyOne && !needsDest
  const kinds = skipDest ? (["amount", "confirm"] as const) : (["amount", "dest", "confirm"] as const)
  const kind = kinds[step - 1] ?? "amount"
  const labels = { amount: tx("amount"), dest: tx("dest"), confirm: tx("confirm") }

  const minor = m.toMinor(amount)
  const limits = (): string => {
    if (minor === null) return s("field.invalid")
    if (minor > w.available) return s("field.insufficientFunds")
    if (method?.minMinor != null && minor < method.minMinor) return s("field.belowMinimum")
    if (method?.maxMinor != null && minor > method.maxMinor) return s("field.aboveMaximum")
    return ""
  }
  const liveError = amount.trim() === "" ? "" : limits()
  const canNextAmount = amount.trim() !== "" && limits() === ""

  if (!canOperate(w)) return <Gate w={w} />
  if (saved.length === 0 && others.length === 0) {
    return (
      <div className="wd">
        <div className="info-box"><CircleHelp size={18} /><p>{tx("noAccount")}</p></div>
        <button className="primary-button" onClick={() => navigate("/deposit")}>{tx("goDeposit")}</button>
      </div>
    )
  }

  if (result) {
    return (
      <motion.div className="wd wd-done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <motion.div className="wd-done-icon" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} role="status">
          <Check size={40} strokeWidth={3} />
        </motion.div>
        <h2>{tx("doneTitle")}</h2>
        <p>{tx("doneText")}</p>
        <div className="wd-summary">
          <div><span>{tx("reference")}</span><strong>{result.reference}</strong></div>
          <div><span>{tx("status")}</span><strong>{tx("pending")}</strong></div>
        </div>
        <button className="primary-button" onClick={() => navigate("/history")}>{tx("history")}</button>
        <button className="secondary-button" onClick={() => navigate("/")}>{tx("home")}</button>
      </motion.div>
    )
  }

  const next = () => {
    setError("")
    if (kind === "amount") {
      const e = limits()
      if (e) return setError(e)
    }
    if (kind === "dest") {
      if (!method && !account) return setError(s("chooseOne"))
      if (needsDest && destination.trim().length < 4) return setError(s("field.invalid"))
      const e = limits()
      if (e) return setError(e)
    }
    setStep(step + 1)
  }

  const confirm = async () => {
    if (minor === null || (!method && !account)) return
    setBusy(true)
    setError("")
    try {
      const r = await withLoader({ title: tx("sending") }, () =>
        platformApi.createWithdrawal(account ? { amountMinor: minor, accountId: account.id } : { methodId: method?.id ?? "", amountMinor: minor, destination: destination.trim() }, key.current),
      )
      key.current = newKey()
      setResult({ reference: r.reference })
    } catch (e) {
      setError(err(e))
    } finally {
      setBusy(false)
    }
  }

  const quick = (pct: number) => {
    const v = pct === 1 ? w.available : Math.floor(w.available * pct)
    setAmount(v > 0 ? String(v / factor) : "")
    setError("")
  }

  const canContinue = kind === "amount" ? canNextAmount : kind === "dest" ? !!(method || account) && (!needsDest || destination.trim().length >= 4) : true

  return (
    <div className="wd">
      <div className="wd-progress" aria-label={tx("stepOf", { n: step, t: kinds.length })}>
        <div className="wd-progress-top">
          <b>{labels[kind]}</b>
          <span>{tx("stepOf", { n: step, t: kinds.length })}</span>
        </div>
        <div className="wd-track"><motion.span animate={{ width: `${(step / kinds.length) * 100}%` }} transition={{ duration: 0.4, ease: EASE }} /></div>
      </div>

      {error && <div className="info-box" role="alert"><CircleHelp size={18} /><p>{error}</p></div>}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={kind} className="wd-body" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }} transition={{ duration: 0.22, ease: EASE }}>
          {kind === "amount" && (
            <>
              <h2 className="wd-title">{tx("howMuch")}</h2>
              <label className="wd-amount">
                <span className="wd-symbol">{symbol}</span>
                <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label={tx("amountLbl")} />
              </label>
              <div className="wd-available"><span>{tx("available")}</span><strong>{m.fmt(w.available)}</strong></div>
              <div className="wd-chips">
                {[0.25, 0.5, 0.75].map((p) => <button key={p} type="button" onClick={() => quick(p)}>{p * 100}%</button>)}
                <button type="button" onClick={() => quick(1)}>{tx("all")}</button>
              </div>
              {liveError && <p className="wd-error" role="alert">{liveError}</p>}
              {w.invested > 0 && <p className="wd-note">{tx("invested")}</p>}
            </>
          )}

          {kind === "dest" && (
            <>
              <h2 className="wd-title">{tx("whereTo")}</h2>
              {saved.length > 0 && (
                <>
                  <p className="wd-sub">{tx("savedAccounts")}</p>
                  <div className="wd-options">
                    {saved.map((a) => {
                      const brand = railBrand(a.rail)
                      const on = effAccountId === a.id
                      return (
                        <button key={a.id} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => { setAccountId(a.id); setMethodId("") }}>
                          {brand ? <BrandIcon id={brand} size={44} /> : <span className="wd-ico"><Landmark size={20} /></span>}
                          <span className="wd-opt-text"><strong>{railName(a.rail)}</strong><small>{a.holder} · {mask(a.detail)}</small></span>
                          <span className="wd-tick">{on && <Check size={18} strokeWidth={3} />}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              {others.length > 0 && (
                <>
                  {saved.length > 0 && <p className="wd-sub">{tx("otherMethods")}</p>}
                  <div className="wd-options">
                    {others.map((x) => {
                      const on = effMethodId === x.id
                      const info = [x.minMinor !== null ? `${tx("min")} ${m.fmt(x.minMinor)}` : "", x.maxMinor !== null ? `${tx("max")} ${m.fmt(x.maxMinor)}` : "", x.feeMinor !== null ? `${tx("fee")} ${m.fmt(x.feeMinor)}` : "", x.feeNote].filter(Boolean).join(" · ")
                      return (
                        <button key={x.id} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => { setMethodId(x.id); setAccountId("") }}>
                          <span className="wd-ico"><Landmark size={20} /></span>
                          <span className="wd-opt-text"><strong>{x.name}</strong>{info && <small>{info}</small>}</span>
                          <span className="wd-tick">{on && <Check size={18} strokeWidth={3} />}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              {needsDest && (
                <label className="wd-field"><span>{tx("account")}</span><input value={destination} onChange={(e) => setDestination(e.target.value)} /></label>
              )}
            </>
          )}

          {kind === "confirm" && minor !== null && (method || account) && (
            <>
              <h2 className="wd-title">{tx("review")}</h2>
              <div className="wd-review">
                <small>{tx("amountLbl")}</small>
                <strong>{m.fmt(minor)}</strong>
              </div>
              <div className="wd-summary">
                <div><span>{tx("to")}</span><strong>{account ? `${railName(account.rail)} · ${account.holder} · ${mask(account.detail)}` : `${method?.name ?? ""} · ${destination.trim()}`}</strong></div>
                {method && method.feeMinor !== null && <div><span>{tx("fee")}</span><strong>{m.fmt(method.feeMinor)}</strong></div>}
              </div>
              <p className="wd-note">{tx("pendingNote")}</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="wd-actions">
        {step > 1 && (
          <button type="button" className="wd-back" disabled={busy} onClick={() => { setError(""); setStep(step - 1) }}><ChevronLeft size={18} /> {tx("back")}</button>
        )}
        <motion.button type="button" className="primary-button wd-next" whileTap={{ scale: 0.98 }} disabled={busy || !canContinue} onClick={kind === "confirm" ? () => void confirm() : next}>
          {kind === "confirm" ? tx("send") : tx("next")} <ArrowRight size={18} />
        </motion.button>
      </div>
    </div>
  )
}
