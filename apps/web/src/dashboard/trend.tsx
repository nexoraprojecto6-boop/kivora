import { useEffect, useRef, useState } from "react"

/*
 * Seta verde (a subir) ou vermelha (a descer) a piscar. Só mostra; os valores vêm do servidor.
 * A direcção é a do último movimento visto entre dois pedidos; antes de haver movimento usa a de partida (seed).
 */
export type Dir = "up" | "down" | "flat"

export function dirOf(value: number, reference: number, eps = 1e-9): Dir {
  if (value > reference + eps) return "up"
  if (value < reference - eps) return "down"
  return "flat"
}

export function useDirection(value: number | null | undefined, seed: Dir = "flat", eps = 1e-9): Dir {
  const prev = useRef<number | null>(null)
  const [dir, setDir] = useState<Dir>(seed)
  useEffect(() => {
    if (value === null || value === undefined) return
    if (prev.current !== null) {
      if (value > prev.current + eps) setDir("up")
      else if (value < prev.current - eps) setDir("down")
    }
    prev.current = value
  }, [value, eps])
  return dir
}

export function TrendArrow({ dir, size = 14, label }: { dir: Dir; size?: number; label?: string }) {
  if (dir === "flat") {
    return (
      <svg className="tr tr-flat" width={size} height={size} viewBox="0 0 12 12" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <rect x="1.5" y="5" width="9" height="2" />
      </svg>
    )
  }
  return (
    <svg className={`tr tr-${dir}`} width={size} height={size} viewBox="0 0 12 12" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={dir === "up" ? "M6 1 L11.5 10.5 H0.5 Z" : "M6 11 L11.5 1.5 H0.5 Z"} />
    </svg>
  )
}
