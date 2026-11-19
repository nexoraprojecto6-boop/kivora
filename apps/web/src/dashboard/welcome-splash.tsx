import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useAuth } from "../features/auth/AuthContext.js"
import { Logo } from "../brand/index.js"
import { useI18n } from "../i18n/I18nProvider.js"
import { WELCOME_KEY } from "../services/welcome.js"
import { EASE } from "./motion-kit.js"
import "./welcome-splash.css"

const TEXT: Record<string, { hello: string; sub: string }> = {
  pt: { hello: "Bem-vindo", sub: "A preparar a sua conta" },
  en: { hello: "Welcome", sub: "Preparing your account" },
  es: { hello: "Bienvenido", sub: "Preparando su cuenta" },
  fr: { hello: "Bienvenue", sub: "Préparation de votre compte" },
}

/** Ecrã rápido de boas-vindas com o nome do cliente, só quando acaba de iniciar sessão. */
export function WelcomeSplash() {
  const { user } = useAuth()
  const { language } = useI18n()
  const [show, setShow] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(WELCOME_KEY) === "1"
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!show) return
    try {
      window.sessionStorage.removeItem(WELCOME_KEY)
    } catch {
      // ignorar
    }
    const id = setTimeout(() => setShow(false), 2300)
    return () => clearTimeout(id)
  }, [show])

  const name = user?.fullName?.trim().split(/\s+/)[0] ?? ""
  const tx = TEXT[language] ?? TEXT["pt"]!
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="ws"
          role="status"
          aria-live="polite"
          onClick={() => setShow(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <motion.div className="ws-card" initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}><Logo height={40} /></motion.div>
            <motion.small className="ws-hello" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>{tx.hello}</motion.small>
            <motion.h2 className="ws-name" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.5, ease: EASE }}>{name}</motion.h2>
            <p className="ws-sub">{tx.sub}</p>
            <div className="ws-bar" aria-hidden="true"><motion.span initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ delay: 0.3, duration: 1.9, ease: "easeInOut" }} /></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
