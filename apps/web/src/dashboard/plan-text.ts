/*
 * Textos novos do painel profissional do plano. São somados aos de plan-panel.tsx
 * (os de lá continuam a valer; aqui só há chaves novas).
 */
export type Txt = Record<string, string>

export const EXTRA_TEXT: Record<string, Txt> = {
  pt: {
    liveBadge: "Ao vivo", goLive: "Ao vivo", modeCandles: "Velas", modeLine: "Linha", zoomIn: "Aproximar", zoomOut: "Afastar",
    ohlcO: "A", ohlcH: "Máx", ohlcL: "Mín", ohlcC: "F", dragHint: "Arraste o gráfico para ver o histórico.",
    trendUp: "A subir", trendDown: "A descer", trendFlat: "Estável", pace2: "Ritmo da comissão", rateNormal: "Normal",
    commissionNow: "Comissão a gerar agora", totalGenerated: "Comissão total gerada", candlesFor: "Velas de {t}",
    marketHistory: "Histórico do mercado", delayed: "Dados com possível atraso",
  },
  en: {
    liveBadge: "Live", goLive: "Live", modeCandles: "Candles", modeLine: "Line", zoomIn: "Zoom in", zoomOut: "Zoom out",
    ohlcO: "O", ohlcH: "H", ohlcL: "L", ohlcC: "C", dragHint: "Drag the chart to see the history.",
    trendUp: "Rising", trendDown: "Falling", trendFlat: "Steady", pace2: "Commission pace", rateNormal: "Normal",
    commissionNow: "Commission being generated now", totalGenerated: "Total commission generated", candlesFor: "{t} candles",
    marketHistory: "Market history", delayed: "Data may be delayed",
  },
  es: {
    liveBadge: "En vivo", goLive: "En vivo", modeCandles: "Velas", modeLine: "Línea", zoomIn: "Acercar", zoomOut: "Alejar",
    ohlcO: "A", ohlcH: "Máx", ohlcL: "Mín", ohlcC: "C", dragHint: "Arrastre el gráfico para ver el historial.",
    trendUp: "Subiendo", trendDown: "Bajando", trendFlat: "Estable", pace2: "Ritmo de la comisión", rateNormal: "Normal",
    commissionNow: "Comisión generándose ahora", totalGenerated: "Comisión total generada", candlesFor: "Velas de {t}",
    marketHistory: "Historial del mercado", delayed: "Datos con posible retraso",
  },
  fr: {
    liveBadge: "En direct", goLive: "Direct", modeCandles: "Bougies", modeLine: "Ligne", zoomIn: "Zoom avant", zoomOut: "Zoom arrière",
    ohlcO: "O", ohlcH: "H", ohlcL: "B", ohlcC: "C", dragHint: "Faites glisser le graphique pour voir l’historique.",
    trendUp: "En hausse", trendDown: "En baisse", trendFlat: "Stable", pace2: "Rythme de la commission", rateNormal: "Normal",
    commissionNow: "Commission en cours de génération", totalGenerated: "Commission totale générée", candlesFor: "Bougies de {t}",
    marketHistory: "Historique du marché", delayed: "Données possiblement retardées",
  },
}
