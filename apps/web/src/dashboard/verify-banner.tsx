import { useEffect } from "react"
import { ChevronRight, Fingerprint } from "lucide-react"
import type { WalletDto } from "@kivora/shared"
import { useAuth } from "../features/auth/AuthContext.js"
import { copyFor } from "../features/verify/copy.js"
import { useI18n } from "../i18n/I18nProvider.js"
import { redirectTo } from "../services/navigation.js"

/** O fluxo de verificação (email + bilhete + selfie) vive na página /verify, fora do painel. */
const VERIFY_URL = "/verify"

/** Faixa «Conta a verificar» no painel: o utilizador já pode entrar, mas vê o que falta. */
export function VerifyBanner({ w }: { w: WalletDto }) {
  const { language } = useI18n()
  const { user } = useAuth()
  const c = copyFor(language)
  if (!user) return null

  let text: string | null = null
  if (!user.emailVerified) text = c("b.verifyEmail")
  else if (w.verificationStatus === "NONE") text = c("b.sendDocs")
  else if (w.verificationStatus === "PENDING") text = c("b.pending")
  else if (w.verificationStatus === "REJECTED") text = c("b.rejected")
  if (!text) return null

  return (
    <button className="info-box" onClick={() => redirectTo(VERIFY_URL)} aria-label={`${text}. ${c("b.action")}`}>
      <Fingerprint size={18} /><p>{text}</p><ChevronRight size={16} />
    </button>
  )
}

/** Rota /verification do painel: leva para a página de verificação por passos. */
export function VerifyRedirect() {
  useEffect(() => redirectTo(VERIFY_URL), [])
  return null
}
