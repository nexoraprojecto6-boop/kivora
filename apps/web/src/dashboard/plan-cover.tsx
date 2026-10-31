import { useState } from "react"
import { Gem, Layers, Sparkles } from "lucide-react"
import { assetUrl } from "../services/api-client.js"

/*
 * Capa do plano. Usada em TODAS as vistas (início, lista de planos, "os meus planos", detalhe e painel),
 * para a foto que a administração carregou aparecer sempre. Sem foto (ou se falhar a carregar) mostra o desenho de reserva.
 *  - "card": ocupa o espaço .plan-visual dos cartões (dimensões do CSS original).
 *  - "thumb": miniatura quadrada para linhas de lista.
 *  - "hero": faixa larga no topo do detalhe e do painel.
 */
type Variant = "card" | "thumb" | "hero"
const TONES = ["", "gold", "violet", "sky"]
const ICONS = [Gem, Layers, Sparkles]

export function PlanCover({ imageUrl, index = 0, variant = "card", large = false }: { imageUrl: string | null | undefined; index?: number; variant?: Variant; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(imageUrl) && !failed
  const Icon = ICONS[index % 3] ?? Gem
  const tone = TONES[index % 4] ?? ""
  const base = variant === "card" ? `plan-visual ${tone} ${large ? "large" : ""}` : variant === "thumb" ? `plan-visual pc-thumb ${tone}` : `plan-visual pc-hero ${tone}`
  return (
    <div className={`${base} pc ${showImage ? "pc--photo" : "pc--fallback"}`} aria-hidden="true">
      {showImage ? (
        <img className="pc-img" src={assetUrl(imageUrl as string)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <>
          <span className="visual-orb" />
          <Icon size={variant === "hero" ? 56 : variant === "thumb" ? 20 : large ? 56 : 38} />
        </>
      )}
    </div>
  )
}
