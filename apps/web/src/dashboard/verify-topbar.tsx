import { ChevronRight, Clock3, Fingerprint, ShieldAlert } from "lucide-react"
import { motion } from "motion/react"
import { useAuth } from "../features/auth/AuthContext.js"
import { copyFor } from "../features/verify/copy.js"
import { useI18n } from "../i18n/I18nProvider.js"
import { redirectTo } from "../services/navigation.js"
import { EASE } from "./motion-kit.js"
import { useWallet } from "./screens.js"
import "./verify-topbar.css"

/** O fluxo de verificação (email + bilhete + selfie) vive na página /verify, fora do painel. */
const VERIFY_URL = "/verify"

/**
 * Faixa fixa no topo de TODAS as páginas do painel enquanto a conta não estiver verificada.
 * A verificação é obrigatória: depósitos, levantamentos e compras de planos só abrem depois dela.
 */
export function VerifyTopBar() {
  const { user } = useAuth()
  const { language } = useI18n()
  const wallet = useWallet()
  const c = copyFor(language)
  const w = wallet.data
  if (!user || !w) return null

  let kind: "todo" | "pending" | "rejected" | null = null
  let text = ""
  if (!user.emailVerified) { kind = "todo"; text = c("b.verifyEmail") }
  else if (w.verificationStatus === "NONE") { kind = "todo"; text = c("b.sendDocs") }
  else if (w.verificationStatus === "PENDING") { kind = "pending"; text = c("b.pending") }
  else if (w.verificationStatus === "REJECTED") { kind = "rejected"; text = c("b.rejected") }
  if (!kind) return null

  const Icon = kind === "pending" ? Clock3 : kind === "rejected" ? ShieldAlert : Fingerprint
  return (
    <motion.button
      type="button"
      className={`vtb vtb--${kind}`}
      onClick={() => redirectTo(VERIFY_URL)}
      aria-label={`${text}. ${c("b.action")}`}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <span className="vtb-icon"><Icon size={20} /></span>
      <span className="vtb-text">{text}</span>
      <span className="vtb-cta">{c("b.action")}<ChevronRight size={16} /></span>
    </motion.button>
  )
}
