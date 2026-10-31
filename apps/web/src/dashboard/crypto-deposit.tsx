import { useState } from "react"
import { ArrowLeft, ChevronRight, ShieldAlert } from "lucide-react"
import type { PaymentMethodDto } from "@kivora/shared"
import "./crypto.css"

/*
 * Depósito por criptomoeda — passos «moeda/rede» e «painel da rede».
 * O administrador define moeda, rede e endereço em Métodos de pagamento (serviço «Criptomoeda»).
 * Os logótipos são ficheiros em /crypto-icons/<símbolo>.svg (pasta apps/web/public/crypto-icons);
 * sem ficheiro, mostra-se um círculo com as letras da moeda.
 */

/** Logótipo da moeda (SVG real); se faltar o ficheiro, círculo com as letras. */
export function CoinIcon({ symbol, size = 44 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const key = symbol.trim().toLowerCase()
  return (
    <span className="cx-coin" style={{ width: size, height: size }}>
      {failed || key === "" ? (
        <span className="cx-coin__letters" style={{ fontSize: Math.max(10, Math.round(size * 0.3)) }}>{symbol.slice(0, 4).toUpperCase()}</span>
      ) : (
        <img src={`/crypto-icons/${key}.svg`} alt="" width={size} height={size} onError={() => setFailed(true)} />
      )}
    </span>
  )
}

/** Símbolo da moeda nativa da rede (para mostrar o logótipo da rede), ou null. */
export function networkSymbol(network: string): string | null {
  const n = network.toLowerCase()
  if (/tron|trc/.test(n)) return "trx"
  if (/bnb|bsc|bep/.test(n)) return "bnb"
  if (/solana/.test(n)) return "sol"
  if (/polygon|matic/.test(n)) return "matic"
  if (/avalanche|avax/.test(n)) return "avax"
  if (/litecoin/.test(n)) return "ltc"
  if (/xrp|ripple/.test(n)) return "xrp"
  if (/doge/.test(n)) return "doge"
  if (/cardano/.test(n)) return "ada"
  if (/polkadot/.test(n)) return "dot"
  if (/bitcoin|btc/.test(n)) return "btc"
  if (/ethereum|erc|arbitrum|optimism|base/.test(n)) return "eth"
  return null
}

function Head({ step, title, sub }: { step: number; title: string; sub: string }) {
  return (
    <div className="dp-head">
      <div className="dp-progress" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step} aria-label={`Passo ${step} de 5`}>
        <i style={{ width: `${(step / 5) * 100}%` }} />
      </div>
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  )
}

function Back({ onClick }: { onClick: () => void }) {
  return <button type="button" className="dp-back" onClick={onClick}><ArrowLeft size={15} /> Voltar</button>
}

/** Passo 2: moedas/redes que o administrador activou. */
export function CryptoStep({ methods, onPick, onBack }: { methods: PaymentMethodDto[]; onPick: (m: PaymentMethodDto) => void; onBack: () => void }) {
  return (
    <>
      <Back onClick={onBack} />
      <Head step={2} title="Escolha a criptomoeda" sub="Moedas e redes disponíveis neste momento." />
      {methods.length === 0 ? <p className="dp-muted">De momento não há criptomoedas disponíveis. Tente mais tarde.</p> : null}
      <div className="dp-list">
        {methods.map((m) => {
          const net = networkSymbol(m.network)
          return (
            <button key={m.id} type="button" className="dp-option" onClick={() => onPick(m)}>
              <CoinIcon symbol={m.coin} />
              <span className="dp-option__text">
                <b>{m.coin}</b>
                <small className="cx-net">{net ? <CoinIcon symbol={net} size={14} /> : null}{m.network}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          )
        })}
      </div>
    </>
  )
}

/** Passo 3: painel com a rede e a moeda a depositar. */
export function CryptoInfoStep({ method, fmt, onContinue, onBack }: { method: PaymentMethodDto; fmt: (minor: number) => string; onContinue: () => void; onBack: () => void }) {
  const net = networkSymbol(method.network)
  return (
    <>
      <Back onClick={onBack} />
      <Head step={3} title={`Depositar ${method.coin}`} sub="Confirme a rede e a moeda antes de continuar." />
      <section className="dp-card cx-panel" aria-label="Rede e moeda do depósito">
        <div className="cx-panel__hero"><CoinIcon symbol={method.coin} size={64} /></div>
        <div className="cx-row">
          <span className="cx-row__label">Moeda a depositar</span>
          <span className="cx-row__value"><CoinIcon symbol={method.coin} size={22} /><b>{method.coin}</b></span>
        </div>
        <div className="cx-row">
          <span className="cx-row__label">Rede</span>
          <span className="cx-row__value">{net ? <CoinIcon symbol={net} size={22} /> : null}<b>{method.network}</b></span>
        </div>
        {method.minMinor !== null || method.maxMinor !== null ? (
          <div className="cx-row">
            <span className="cx-row__label">Limites</span>
            <span className="cx-row__value"><b>{method.minMinor !== null ? `Mín. ${fmt(method.minMinor)}` : ""}{method.minMinor !== null && method.maxMinor !== null ? " · " : ""}{method.maxMinor !== null ? `Máx. ${fmt(method.maxMinor)}` : ""}</b></span>
          </div>
        ) : null}
        <p className="cx-warning" role="note">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>Envie <b>apenas {method.coin}</b> pela rede <b>{method.network}</b>. Outra moeda ou outra rede pode fazer perder os fundos.</span>
        </p>
      </section>
      <button type="button" className="dp-primary" onClick={onContinue}>Continuar</button>
    </>
  )
}
