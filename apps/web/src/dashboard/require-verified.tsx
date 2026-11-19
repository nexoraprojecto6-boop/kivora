import type { ReactNode } from "react"
import { Fingerprint, Clock3, ShieldAlert } from "lucide-react"
import { motion } from "motion/react"
import { useAuth } from "../features/auth/AuthContext.js"
import { copyFor } from "../features/verify/copy.js"
import { useI18n } from "../i18n/I18nProvider.js"
import { redirectTo } from "../services/navigation.js"
import { Header, Page } from "./App.js"
import { EASE } from "./motion-kit.js"
import { useWallet } from "./screens.js"

/**
 * Verificação obrigatória: depósitos e levantamentos só abrem com o email confirmado e a identidade aprovada.
 * Enquanto isso, a página mostra o motivo e o botão para continuar a verificação (mantém o título da página).
 */
export function RequireVerified({ titleKey, children }: { titleKey: string; children: ReactNode }) {
  const { t, language } = useI18n()
  const { user } = useAuth()
  const wallet = useWallet()
  const c = copyFor(language)
  const w = wallet.data
  // Sem dados (a carregar ou erro): a própria página trata disso.
  if (!w || !user) return <>{children}</>
  if (user.emailVerified && w.verificationStatus === "APPROVED") return <>{children}</>

  const pending = user.emailVerified && w.verificationStatus === "PENDING"
  const rejected = user.emailVerified && w.verificationStatus === "REJECTED"
  const Icon = pending ? Clock3 : rejected ? ShieldAlert : Fingerprint
  const text = !user.emailVerified ? c("b.verifyEmail") : pending ? c("b.pending") : rejected ? c("b.rejected") : c("b.sendDocs")
  return (
    <Page className="form-page">
      <Header title={t(titleKey)} back />
      <div className="form-surface">
        <motion.div className="rv" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
          <span className="rv-icon"><Icon size={34} /></span>
          <h2>{c("b.action")}</h2>
          <p>{text}</p>
          <button type="button" className="primary-button" onClick={() => redirectTo("/verify")}>{c("b.action")}</button>
        </motion.div>
      </div>
    </Page>
  )
}
