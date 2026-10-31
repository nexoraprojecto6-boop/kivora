import { useEffect, useRef, useState } from "react"
import { Clock3 } from "lucide-react"
import { copyFor } from "../features/verify/copy.js"
import { useI18n } from "../i18n/I18nProvider.js"
import { clearVerificationNotice, hasVerificationNotice } from "../services/verification-notice.js"
import "./verify-pending.css"

/**
 * Modal por cima do painel, mostrado uma vez logo depois de enviar o bilhete e a selfie:
 * «Conta em verificação — pendente. Obrigado!». A faixa «Conta a verificar» no Início continua a existir.
 */
export function VerifyPendingModal() {
  const { language } = useI18n()
  const c = copyFor(language)
  const [open, setOpen] = useState<boolean>(() => hasVerificationNotice())
  const button = useRef<HTMLButtonElement>(null)

  const close = () => {
    clearVerificationNotice()
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    button.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearVerificationNotice()
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  if (!open) return null
  return (
    <div className="vp-overlay" onClick={close}>
      <div
        className="vp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vp-title"
        aria-describedby="vp-body"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="vp-icon" aria-hidden="true"><Clock3 size={34} /></span>
        <span className="vp-pill">{c("m.status")}</span>
        <h2 id="vp-title">{c("m.title")}</h2>
        <p id="vp-body">{c("m.body")}</p>
        <button ref={button} type="button" className="vp-btn" onClick={close}>{c("m.ok")}</button>
      </div>
    </div>
  )
}
