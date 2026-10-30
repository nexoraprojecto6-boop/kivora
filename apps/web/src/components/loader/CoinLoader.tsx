import "./loader.css"

/** Loader: moedas 3D a girar em círculo e a entrar no mealheiro. Só CSS (ver loader.css). */
export function CoinLoader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="dp-loader" role="status" aria-live="polite">
      <div className="dp-stage" aria-hidden="true">
        <div className="dp-glow" />
        <div className="dp-ring" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="dp-coin-path" style={{ animationDelay: `${-i * 0.75}s` }}>
            <div className="dp-coin"><span>Kz</span></div>
          </div>
        ))}
        <svg className="dp-pig" viewBox="0 0 160 120" width="150" height="112">
          <defs>
            <linearGradient id="dpPigBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb3c7" />
              <stop offset="1" stopColor="#ff86a6" />
            </linearGradient>
          </defs>
          <ellipse cx="80" cy="112" rx="46" ry="6" fill="rgba(20,35,59,.18)" />
          <rect x="34" y="88" width="16" height="22" rx="7" fill="#ff7d9f" />
          <rect x="100" y="88" width="16" height="22" rx="7" fill="#ff7d9f" />
          <path d="M126 52c14-4 22 4 18 14-3 8-12 6-14 2" fill="none" stroke="#ff7d9f" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="78" cy="68" rx="52" ry="40" fill="url(#dpPigBody)" />
          <path d="M44 38l6-20 18 12z" fill="#ff86a6" />
          <ellipse cx="124" cy="70" rx="15" ry="12" fill="#ff9db8" />
          <circle cx="119" cy="70" r="2.6" fill="#b3365c" />
          <circle cx="129" cy="70" r="2.6" fill="#b3365c" />
          <circle cx="100" cy="54" r="4.5" fill="#14233b" />
          <circle cx="101.6" cy="52.6" r="1.4" fill="#fff" />
          <ellipse cx="88" cy="66" rx="7" ry="4" fill="#ff7d9f" opacity=".55" />
          <rect x="62" y="31" width="34" height="6" rx="3" fill="#b3365c" />
        </svg>
      </div>
      <p className="dp-loader__title">{title}<span className="dp-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></p>
      {subtitle ? <p className="dp-loader__sub">{subtitle}</p> : null}
    </div>
  )
}
