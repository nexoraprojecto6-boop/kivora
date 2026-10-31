import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Minus, Plus } from "lucide-react"
import type { EarningsSeriesDto, MarketPointDto, SeriesBucket } from "@kivora/shared"
import { platformApi } from "../services/api-client.js"
import { TrendArrow, dirOf, useDirection, type Dir } from "./trend.js"

/*
 * Gráficos do painel do plano, em SVG puro (sem bibliotecas).
 *  - MarketChart: velas ou linha, 4 intervalos (1m, 5m, 15m, 1h), arrastar para ver o histórico, zoom, cursor com A/Máx/Mín/F,
 *    linha do preço actual com etiqueta e ponto a piscar. Só desenha os pontos que o servidor guardou: nada é inventado.
 *  - CommissionChart: barras da comissão gerada, com a MESMA moldura (margens, grelha, eixo à direita) para ficarem alinhados.
 */
type Tx = (key: string, params?: Record<string, string | number>) => string

// Moldura partilhada pelos dois gráficos (é isto que os mantém alinhados).
const W = 360, H = 280, ML = 6, MR = 58, MT = 10, MB = 20
const PW = W - ML - MR, PH = H - MT - MB
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo || Math.abs(hi) || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step, i = 0; v <= hi + step * 1e-9 && i < 14; v += step, i++) out.push(v)
  return out
}
const decimalsFor = (p: number): number => (p >= 1000 ? 2 : p >= 100 ? 3 : p >= 10 ? 4 : p >= 1 ? 5 : 6)
const fmt = (v: number, d: number): string => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
const hhmm = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
const dayHour = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}h`
}

/* ---------------- velas ---------------- */
interface Candle { t: number; o: number; h: number; l: number; c: number }

/** Agrupa os pontos guardados em velas. A abertura de cada vela é o fecho da anterior (sem buracos entre velas). */
export function toCandles(points: MarketPointDto[], seconds: number): Candle[] {
  const out: Candle[] = []
  const ms = seconds * 1000
  for (const p of points) {
    const b = Math.floor(Date.parse(p.t) / ms) * ms
    const last = out[out.length - 1]
    if (last && last.t === b) {
      last.h = Math.max(last.h, p.price)
      last.l = Math.min(last.l, p.price)
      last.c = p.price
    } else {
      const open = last ? last.c : p.price
      out.push({ t: b, o: open, h: Math.max(open, p.price), l: Math.min(open, p.price), c: p.price })
    }
  }
  return out
}

const FRAMES = [{ k: "1m", s: 60 }, { k: "5m", s: 300 }, { k: "15m", s: 900 }, { k: "1h", s: 3600 }] as const
const ZOOMS = [24, 48, 90, 160]

interface MarketProps {
  points: MarketPointDto[]
  label: string
  price: number | null
  changePct: number | null
  stale: boolean
  tx: Tx
}

export function MarketChart({ points, label, price, changePct, stale, tx }: MarketProps) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{ x: number; offset: number } | null>(null)
  const [frame, setFrame] = useState<(typeof FRAMES)[number]["k"]>("5m")
  const [mode, setMode] = useState<"candles" | "line">("candles")
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  const secs = FRAMES.find((f) => f.k === frame)?.s ?? 300
  const candles = useMemo(() => toCandles(points, secs), [points, secs])
  const total = candles.length
  const want = ZOOMS[zoom] ?? 48
  const n = Math.max(1, Math.min(want, total))
  const maxOffset = Math.max(0, total - n)
  const off = clamp(offset, 0, maxOffset)
  const end = total - off
  const start = Math.max(0, end - n)
  const win = candles.slice(start, end)
  const m = win.length
  const live = off === 0

  const priceDir = useDirection(price, changePct === null ? "flat" : changePct > 0 ? "up" : changePct < 0 ? "down" : "flat", 1e-12)
  const lastC = win[m - 1]
  const changeDir: Dir = changePct === null ? "flat" : changePct > 0 ? "up" : changePct < 0 ? "down" : "flat"

  if (m < 2) {
    return (
      <div className="tc">
        <MarketHead label={label} price={price} changePct={changePct} stale={stale} dir={priceDir} changeDir={changeDir} tx={tx} />
        <div className="tc-empty">{tx("waiting")}</div>
      </div>
    )
  }

  const slot = PW / m
  const xAt = (i: number): number => ML + slot * (i + 0.5)
  let lo = Infinity, hi = -Infinity
  for (const c of win) { lo = Math.min(lo, mode === "line" ? Math.min(c.c, c.o) : c.l); hi = Math.max(hi, mode === "line" ? Math.max(c.c, c.o) : c.h) }
  if (hi === lo) { hi += Math.abs(hi) * 0.0005 || 1; lo -= Math.abs(lo) * 0.0005 || 1 }
  const pad = (hi - lo) * 0.1
  lo -= pad; hi += pad
  const yAt = (v: number): number => MT + PH * (1 - (v - lo) / (hi - lo))
  const dec = decimalsFor(hi)
  const ticks = niceTicks(lo, hi, 5)
  const shownIdx = hover ?? m - 1
  const shown = win[shownIdx] ?? lastC!
  const shownDir: Dir = dirOf(shown.c, shown.o, 1e-12)
  const lineDir: Dir = dirOf(win[m - 1]!.c, win[0]!.o, 1e-12)
  const up = "var(--tp-up, #19d98b)", down = "var(--tp-down, #ff4d5e)"
  const lineColor = lineDir === "down" ? down : up

  const closes = win.map((c, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(c.c).toFixed(1)}`).join(" ")
  const area = `${closes} L${xAt(m - 1).toFixed(1)} ${(MT + PH).toFixed(1)} L${xAt(0).toFixed(1)} ${(MT + PH).toFixed(1)} Z`

  const labelIdx = [0, Math.round((m - 1) / 3), Math.round(((m - 1) * 2) / 3), m - 1]
  const wide = (win[m - 1]!.t - win[0]!.t) / 3_600_000 > 20
  const stamp = (ms: number): string => (wide ? dayHour(ms) : hhmm(ms))

  const toSvgX = (e: ReactPointerEvent<SVGSVGElement>): number => {
    const r = svgRef.current?.getBoundingClientRect()
    return r && r.width > 0 ? ((e.clientX - r.left) * W) / r.width : 0
  }
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = { x: toSvgX(e), offset: off }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const x = toSvgX(e)
    if (drag.current) {
      setOffset(clamp(drag.current.offset + Math.round((x - drag.current.x) / slot), 0, maxOffset))
      setHover(null)
      return
    }
    setHover(clamp(Math.floor((x - ML) / slot), 0, m - 1))
  }
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const liveY = yAt(win[m - 1]!.c)
  const tagY = clamp(liveY, MT + 7, MT + PH - 7)
  const bw = Math.max(1.6, slot * 0.64)

  return (
    <div className="tc">
      <MarketHead label={label} price={price} changePct={changePct} stale={stale} dir={priceDir} changeDir={changeDir} tx={tx} />

      <div className="tc-bar">
        <div className="tc-tabs" role="tablist" aria-label={tx("marketHistory")}>
          {FRAMES.map((f) => (
            <button key={f.k} type="button" role="tab" aria-selected={frame === f.k} className={frame === f.k ? "on" : ""} onClick={() => { setFrame(f.k); setOffset(0); setHover(null) }}>{f.k}</button>
          ))}
        </div>
        <div className="tc-tabs" role="group">
          <button type="button" className={mode === "candles" ? "on" : ""} aria-pressed={mode === "candles"} onClick={() => setMode("candles")}>{tx("modeCandles")}</button>
          <button type="button" className={mode === "line" ? "on" : ""} aria-pressed={mode === "line"} onClick={() => setMode("line")}>{tx("modeLine")}</button>
        </div>
        <div className="tc-tabs tc-zoom" role="group">
          <button type="button" aria-label={tx("zoomOut")} disabled={zoom >= ZOOMS.length - 1} onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}><Minus size={13} /></button>
          <button type="button" aria-label={tx("zoomIn")} disabled={zoom <= 0} onClick={() => setZoom((z) => Math.max(0, z - 1))}><Plus size={13} /></button>
        </div>
      </div>

      <div className="tc-ohlc" aria-live="off">
        <span className="tc-when">{stamp(shown.t)}</span>
        <span>{tx("ohlcO")} <b>{fmt(shown.o, dec)}</b></span>
        <span>{tx("ohlcH")} <b>{fmt(shown.h, dec)}</b></span>
        <span>{tx("ohlcL")} <b>{fmt(shown.l, dec)}</b></span>
        <span>{tx("ohlcC")} <b className={shownDir === "down" ? "dn" : shownDir === "up" ? "up" : ""}>{fmt(shown.c, dec)}</b></span>
      </div>

      <svg ref={svgRef} className="tc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => { if (!drag.current) setHover(null) }}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: lineColor, stopOpacity: 0.34 }} />
            <stop offset="100%" style={{ stopColor: lineColor, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <rect className="tc-plot" x={ML} y={MT} width={PW} height={PH} />
        {ticks.map((t) => (
          <g key={t}>
            <line className="tc-grid" x1={ML} x2={ML + PW} y1={yAt(t)} y2={yAt(t)} />
            <text className="tc-axis" x={ML + PW + 5} y={yAt(t) + 3}>{fmt(t, dec)}</text>
          </g>
        ))}
        {labelIdx.map((i, k) => (
          <text key={`${i}-${k}`} className="tc-axis" x={clamp(xAt(i), ML + 14, ML + PW - 14)} y={H - 6} textAnchor="middle">{stamp(win[i]!.t)}</text>
        ))}

        {mode === "candles" ? (
          win.map((c, i) => {
            const isUp = c.c >= c.o
            const x = xAt(i)
            const top = yAt(Math.max(c.o, c.c)), bottom = yAt(Math.min(c.o, c.c))
            const isLast = live && i === m - 1
            return (
              <g key={c.t} className={`tc-candle ${isUp ? "up" : "dn"} ${isLast ? "tc-live" : ""}`}>
                <line x1={x} x2={x} y1={yAt(c.h)} y2={yAt(c.l)} />
                <rect x={x - bw / 2} y={top} width={bw} height={Math.max(1.2, bottom - top)} />
              </g>
            )
          })
        ) : (
          <>
            <path d={area} style={{ fill: `url(#g${gid})` }} />
            <path className="tc-line" d={closes} style={{ stroke: lineColor }} />
          </>
        )}

        {live && (
          <g>
            <line className="tc-last" x1={ML} x2={ML + PW} y1={liveY} y2={liveY} style={{ stroke: lineColor }} />
            <rect className="tc-tag" x={ML + PW + 1} y={tagY - 7} width={MR - 2} height="14" style={{ fill: lineColor }} />
            <text className="tc-tag-t" x={ML + PW + 5} y={tagY + 3}>{fmt(win[m - 1]!.c, dec)}</text>
            <circle className="tc-pulse" cx={xAt(m - 1)} cy={liveY} r="4" style={{ fill: lineColor }} />
            <circle cx={xAt(m - 1)} cy={liveY} r="2.6" style={{ fill: lineColor }} />
          </g>
        )}

        {hover !== null && !drag.current && (
          <g className="tc-cross" pointerEvents="none">
            <line x1={xAt(hover)} x2={xAt(hover)} y1={MT} y2={MT + PH} />
            <line x1={ML} x2={ML + PW} y1={yAt(shown.c)} y2={yAt(shown.c)} />
          </g>
        )}
      </svg>

      <div className="tc-foot">
        <span>{tx("candlesFor", { t: frame })} · {tx("dragHint")}</span>
        {!live && <button type="button" className="tc-golive" onClick={() => { setOffset(0); setHover(null) }}>{tx("goLive")}</button>}
      </div>
    </div>
  )
}

function MarketHead({ label, price, changePct, stale, dir, changeDir, tx }: { label: string; price: number | null; changePct: number | null; stale: boolean; dir: Dir; changeDir: Dir; tx: Tx }) {
  const d = price === null ? 4 : decimalsFor(price)
  return (
    <div className="tc-head">
      <div className="tc-sym">
        <strong>{label}</strong>
        <span className={`tc-live-badge ${stale ? "off" : "on"}`}><i aria-hidden="true" />{stale ? tx("delayed") : tx("liveBadge")}</span>
      </div>
      <div className="tc-quote">
        <b className={dir === "down" ? "dn" : dir === "up" ? "up" : ""}>{price === null ? "—" : fmt(price, d)}</b>
        <TrendArrow dir={dir} size={16} label={dir === "up" ? tx("trendUp") : dir === "down" ? tx("trendDown") : tx("trendFlat")} />
        {changePct !== null && (
          <span className={`tc-chg ${changeDir === "down" ? "dn" : changeDir === "up" ? "up" : ""}`}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%</span>
        )}
      </div>
    </div>
  )
}

/* ---------------- comissão gerada (barras, mesma moldura) ---------------- */

export function CommissionChart({ id, active, tx, axisNum, fine }: { id: string; active: boolean; tx: Tx; axisNum: (minor: number) => string; fine: (minor: number) => string }) {
  const [bucket, setBucket] = useState<SeriesBucket>("hour")
  const [data, setData] = useState<EarningsSeriesDto | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!active) return
    let alive = true
    const load = () => { platformApi.earningsSeries(id, bucket).then((d) => { if (alive) setData(d) }, () => undefined) }
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [id, bucket, active])

  const pts = (data?.points ?? []).slice(-60)
  const count = pts.length
  const max = Math.max(1e-9, ...pts.map((p) => p.amountMinor))
  const top = max * 1.12
  const slot = count > 0 ? PW / count : PW
  const yAt = (v: number): number => MT + PH * (1 - v / top)
  const label = (iso: string): string => {
    const d = new Date(iso)
    return bucket === "day" ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : hhmm(d.getTime())
  }
  const lastDir: Dir = count >= 2 ? dirOf(pts[count - 1]!.amountMinor, pts[count - 2]!.amountMinor, 1e-9) : "flat"
  const shownIdx = hover ?? count - 1
  const shown = pts[shownIdx]
  const ticks = niceTicks(0, top, 5)
  const labelIdx = count > 1 ? [0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1] : []
  const bw = Math.max(1.6, slot * 0.66)

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r || r.width <= 0 || count === 0) return
    const x = ((e.clientX - r.left) * W) / r.width
    setHover(clamp(Math.floor((x - ML) / slot), 0, count - 1))
  }

  return (
    <div className="tc">
      <div className="tc-head">
        <div className="tc-sym"><strong>{tx("seriesTitle")}</strong></div>
        <div className="tc-quote">
          <b className={lastDir === "down" ? "dn" : "up"}>{shown ? fine(shown.amountMinor) : "—"}</b>
          <TrendArrow dir={lastDir} size={16} label={lastDir === "up" ? tx("trendUp") : lastDir === "down" ? tx("trendDown") : tx("trendFlat")} />
        </div>
      </div>
      <div className="tc-bar">
        <div className="tc-tabs" role="tablist">
          {(["minute", "hour", "day"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={bucket === k} className={bucket === k ? "on" : ""} onClick={() => { setBucket(k); setHover(null) }}>{tx(k)}</button>
          ))}
        </div>
        {shown && <span className="tc-when">{label(shown.t)}</span>}
      </div>

      <div className="tc-ohlc">
        <span className="tc-when">{shown ? label(shown.t) : "—"}</span>
        <span>{tx("generated")} <b className={lastDir === "down" ? "dn" : "up"}>{shown ? fine(shown.amountMinor) : "—"}</b></span>
        <span>{tx("ohlcH")} <b>{count > 0 ? fine(max) : "—"}</b></span>
      </div>

      {count === 0 ? <div className="tc-empty">{tx("waiting")}</div> : (
        <svg ref={svgRef} className="tc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx("seriesTitle")} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <rect className="tc-plot" x={ML} y={MT} width={PW} height={PH} />
          {ticks.map((t) => (
            <g key={t}>
              <line className="tc-grid" x1={ML} x2={ML + PW} y1={yAt(t)} y2={yAt(t)} />
              <text className="tc-axis" x={ML + PW + 5} y={yAt(t) + 3}>{axisNum(t)}</text>
            </g>
          ))}
          {labelIdx.map((i, k) => (
            <text key={`${i}-${k}`} className="tc-axis" x={clamp(ML + slot * (i + 0.5), ML + 14, ML + PW - 14)} y={H - 6} textAnchor="middle">{label(pts[i]!.t)}</text>
          ))}
          {pts.map((p, i) => {
            const h = Math.max(1.5, MT + PH - yAt(p.amountMinor))
            const isLast = i === count - 1
            return <rect key={p.t} className={`tc-bar-r ${isLast ? "tc-live" : ""} ${hover === i ? "hov" : ""}`} x={ML + slot * (i + 0.5) - bw / 2} y={MT + PH - h} width={bw} height={h} />
          })}
          {hover !== null && <line className="tc-cross-l" x1={ML + slot * (hover + 0.5)} x2={ML + slot * (hover + 0.5)} y1={MT} y2={MT + PH} />}
        </svg>
      )}
      <div className="tc-foot"><span>{tx("seriesTitle")} · {tx(bucket)}</span></div>
    </div>
  )
}
