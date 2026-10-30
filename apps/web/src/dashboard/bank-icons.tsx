import { useState } from "react"
import { Banknote, Bitcoin, CreditCard, Hash, Smartphone, type LucideIcon } from "lucide-react"

export type BrandId = "angola" | "paypay" | "kwik" | "express" | "referencia" | "crypto" | "card"

const FALLBACK: Record<Exclude<BrandId, "angola">, LucideIcon> = {
  paypay: Smartphone, kwik: Banknote, express: CreditCard, referencia: Hash, crypto: Bitcoin, card: CreditCard,
}

/** Bandeira de Angola (vermelho, preto, emblema amarelo). */
function AngolaFlag({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 90 60" width={size} height={size * (2 / 3)} role="img" aria-label="Bandeira de Angola" style={{ borderRadius: 6 }}>
      <rect width="90" height="30" fill="#cc092f" />
      <rect y="30" width="90" height="30" fill="#000" />
      <path d="M33 38a13 13 0 0 1 24 0" fill="none" stroke="#ffcb00" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M45 20l2.4 7.3h7.6l-6.2 4.5 2.4 7.3-6.2-4.5-6.2 4.5 2.4-7.3-6.2-4.5h7.6z" fill="#ffcb00" />
      <path d="M52 44l9-8" stroke="#ffcb00" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Ícone de um método. Os logótipos oficiais são ficheiros PNG em /bank-icons/<id>.png
 * (pasta apps/web/public/bank-icons). Se o ficheiro não existir, mostra um ícone simples.
 */
export function BrandIcon({ id, size = 44 }: { id: BrandId; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (id === "angola") return <span className="dp-brand dp-brand--flag" style={{ width: size, height: size }}><AngolaFlag size={size - 6} /></span>
  const Fallback = FALLBACK[id]
  return (
    <span className="dp-brand" style={{ width: size, height: size }}>
      {failed ? <Fallback size={Math.round(size * 0.5)} /> : <img src={`/bank-icons/${id}.png`} alt="" onError={() => setFailed(true)} />}
    </span>
  )
}
