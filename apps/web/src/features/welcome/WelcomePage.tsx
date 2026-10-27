import { Fingerprint, Languages, ScanEye, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { LanguageSelect } from "../../components/layout/LanguageSelect.js";
import { Logo } from "../../brand/index.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { DASHBOARD_URL } from "../../services/navigation.js";
import { useAuth } from "../auth/AuthContext.js";

/** Ilustração leve: SVG com animações só de transformação; pára com "reduzir movimento". */
function HeroArt() {
  return (
    <svg className="wl-art" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="hvBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14233b" />
          <stop offset=".55" stopColor="#0d3a99" />
          <stop offset="1" stopColor="#175bff" />
        </linearGradient>
        <radialGradient id="hvGlow" cx=".82" cy=".18" r=".6">
          <stop offset="0" stopColor="#ffd447" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffd447" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hvGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd447" />
          <stop offset="1" stopColor="#ff9f1c" />
        </linearGradient>
        <linearGradient id="hvSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4ff" />
          <stop offset="1" stopColor="#2f7bff" />
        </linearGradient>
      </defs>
      <rect width="1200" height="560" fill="url(#hvBg)" />
      <rect width="1200" height="560" fill="url(#hvGlow)" />
      <g stroke="#fff" strokeOpacity=".07">
        {[110, 220, 330, 440].map((y) => <line key={y} x1="0" x2="1200" y1={y} y2={y} />)}
      </g>
      <g className="hv-drift"><circle cx="960" cy="110" r="92" fill="#48b8ff" fillOpacity=".18" /></g>
      <g className="hv-float"><circle cx="1090" cy="430" r="64" fill="#ffd447" fillOpacity=".2" /></g>
      <g className="hv-float hv-slow"><circle cx="640" cy="470" r="38" fill="#fff" fillOpacity=".08" /></g>
      {[150, 230, 190, 310, 260, 370].map((h, i) => (
        <rect key={h} className="hv-bar" x={720 + i * 56} y={500 - h} width="36" height={h} rx="10" fill={i % 2 ? "url(#hvGold)" : "url(#hvSky)"} />
      ))}
      <polyline className="hv-line" points="700,400 790,345 870,368 960,285 1040,300 1130,205" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="hv-dot" cx="1130" cy="205" r="9" fill="#ffd447" />
      <g className="hv-float hv-fast">
        <circle cx="640" cy="170" r="36" fill="url(#hvGold)" />
        <text x="640" y="179" textAnchor="middle" fontSize="24" fontWeight="700" fill="#14233b">Kz</text>
      </g>
    </svg>
  );
}

const FEATURES: ReadonlyArray<readonly [string, LucideIcon, string]> = [
  ["security", ShieldCheck, "blue"],
  ["clarity", ScanEye, "yellow"],
  ["verification", Fingerprint, "green"],
  ["languages", Languages, "violet"],
];

/** Página inicial pública: sem promessas de rendimento e sem dados inventados. */
export function WelcomePage() {
  const { t } = useI18n();
  const { status } = useAuth();
  const w = (key: string) => t(`auth.welcome.${key}`);
  return (
    <div className="wl">
      <header className="wl-header">
        <Link to="/" aria-label={t("common.app.name")}><Logo /></Link>
        <nav className="wl-actions" aria-label={t("common.app.name")}>
          {status === "authenticated" ? (
            <a className="wl-btn wl-btn--solid" href={DASHBOARD_URL}>{w("openAccount")}</a>
          ) : (
            <>
              <Link className="wl-btn wl-btn--ghost" to="/register">{w("navCreate")}</Link>
              <Link className="wl-btn wl-btn--solid" to="/login">{w("navLogin")}</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="wl-hero">
          <HeroArt />
          <div className="wl-hero__content">
            <span className="wl-eyebrow">{w("eyebrow")}</span>
            <h1>{w("title")}</h1>
            <p>{w("text")}</p>
            <div className="wl-hero__cta">
              <Link className="wl-btn wl-btn--yellow" to="/register">{w("ctaPrimary")}</Link>
              <Link className="wl-btn wl-btn--glass" to="/login">{w("ctaSecondary")}</Link>
            </div>
          </div>
        </section>

        <section className="wl-section" aria-labelledby="wl-features">
          <h2 id="wl-features">{w("featuresTitle")}</h2>
          <div className="wl-grid">
            {FEATURES.map(([key, Icon, tone]) => (
              <article key={key} className={`wl-feature wl-feature--${tone}`}>
                <span className="wl-feature__icon"><Icon size={24} aria-hidden="true" /></span>
                <h3>{w(`features.${key}.title`)}</h3>
                <p>{w(`features.${key}.text`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="wl-section wl-section--soft" aria-labelledby="wl-steps">
          <h2 id="wl-steps">{w("stepsTitle")}</h2>
          <ol className="wl-steps">
            {(["one", "two", "three"] as const).map((k, i) => (
              <li key={k}>
                <span className="wl-steps__n" aria-hidden="true">{i + 1}</span>
                <h3>{w(`steps.${k}.title`)}</h3>
                <p>{w(`steps.${k}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="wl-final">
          <h2>{w("finalTitle")}</h2>
          <p>{w("finalText")}</p>
          <Link className="wl-btn wl-btn--yellow" to="/register">{w("ctaPrimary")}</Link>
        </section>
      </main>

      <footer className="wl-footer">
        <Logo />
        <p>{w("risk")}</p>
        <div className="wl-footer__row">
          <LanguageSelect />
          <small>© {new Date().getFullYear()} KIVORA</small>
        </div>
      </footer>
    </div>
  );
}
