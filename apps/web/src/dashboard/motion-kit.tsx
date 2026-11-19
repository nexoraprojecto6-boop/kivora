import { useEffect, useRef, useState, type ReactNode } from "react"
import { MotionConfig, animate, motion, useReducedMotion } from "motion/react"

/*
 * Animações do dashboard (biblioteca Motion). Tudo respeita «reduzir movimento» do sistema:
 * quem o tiver activo vê as mudanças sem deslocamentos nem contagens.
 */

/** Curva suave, a mesma em todo o painel (rápida a entrar, calma a assentar). */
export const EASE = [0.22, 1, 0.36, 1] as const

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.28, ease: EASE }}>
      {children}
    </MotionConfig>
  )
}

/** Entrada suave de cada página (só entra; não há saída, para o conteúdo nunca ficar atrasado). */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <motion.div key={routeKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE }}>
      {children}
    </motion.div>
  )
}

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }
const itemVariants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE } } }

/** Lista que revela os filhos um a um. */
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={listVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}

/**
 * Valor que «corre» do número anterior para o novo quando muda (saldo depois de um levantamento, por exemplo).
 * Na primeira vez mostra logo o valor certo, sem contar a partir de zero.
 */
export function AnimatedMoney({ minor, format }: { minor: number; format: (minor: number) => string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(minor)
  const last = useRef(minor)
  useEffect(() => {
    if (last.current === minor) return
    if (reduce) {
      last.current = minor
      setShown(minor)
      return
    }
    const controls = animate(last.current, minor, { duration: 0.8, ease: EASE, onUpdate: (v) => setShown(Math.round(v)) })
    last.current = minor
    return () => controls.stop()
  }, [minor, reduce])
  return <>{format(shown)}</>
}
