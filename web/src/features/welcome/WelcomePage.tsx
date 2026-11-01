import { BadgeCheck, Check, Fingerprint, Globe2, Headphones, Languages, ScanEye, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { LanguageSelect } from "../../components/layout/LanguageSelect.js";
import { Logo } from "../../brand/index.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { DASHBOARD_URL } from "../../services/navigation.js";
import { useAuth } from "../auth/AuthContext.js";
import { useCopy } from "../verify/copy.js";
import { CountUp } from "./CountUp.js";
import { HeroCard } from "./HeroCard.js";

const FEATURES: ReadonlyArray<readonly [string, LucideIcon, string]> = [
  ["security", ShieldCheck, "blue"],
  ["clarity", ScanEye, "yellow"],
  ["verification", Fingerprint, "green"],
  ["languages", Languages, "violet"],
];

/** Moedas mostradas na faixa de depósitos (logótipos em /crypto-icons). */
const COINS = ["usdt", "trx", "sol", "bnb", "btc", "eth"] as const;

/**
 * Página inicial pública (lead page): mensagem de confiança, cartão animado, botões de entrar e criar conta
 * no cabeçalho, no topo da página e no fim. Pensada primeiro para telemóvel; sem promessas de rendimento.
 */
export function WelcomePage() {
  const { t } = useI18n();
  const c = useCopy();
  const { status } = useAuth();
  const w = (key: string) => t(`auth.welcome.${key}`);
  const authed = status === "authenticated";

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-wrap lp-header__in">
          <Link to="/" className="lp-logo" aria-label={t("common.app.name")}><Logo height={30} /></Link>
          <nav className="lp-nav" aria-label={t("common.app.name")}>
            <LanguageSelect />
            {authed ? (
              <a className="lp-btn lp-btn--primary" href={DASHBOARD_URL}>{w("openAccount")}</a>
            ) : (
              <>
                <Link className="lp-btn lp-btn--outline" to="/login">{c("lp.signIn")}</Link>
                <Link className="lp-btn lp-btn--primary" to="/register">{c("lp.create")}</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero__grid">
            <div className="lp-hero__copy">
              <h1>{w("title")}</h1>
              <p className="lp-lead">{w("text")}</p>
              <div className="lp-cta">
                {authed ? (
                  <a className="lp-btn lp-btn--primary lp-btn--lg" href={DASHBOARD_URL}>{w("openAccount")}</a>
                ) : (
                  <>
                    <Link className="lp-btn lp-btn--primary lp-btn--lg" to="/register">{c("lp.create")}</Link>
                    <Link className="lp-btn lp-btn--outline lp-btn--lg" to="/login">{c("lp.signIn")}</Link>
                  </>
                )}
              </div>
              <ul className="lp-checks">
                {(["lp.check1", "lp.check2", "lp.check3"] as const).map((k) => (
                  <li key={k}><span aria-hidden="true"><Check size={13} /></span>{c(k)}</li>
                ))}
              </ul>
            </div>
            <div className="lp-hero__visual"><HeroCard /></div>
          </div>
        </section>

        <section className="lp-wrap" aria-label={c("lp.statsLabel")}>
          <div className="lp-stats">
            <div className="lp-stat">
              <Users size={22} aria-hidden="true" />
              <strong><CountUp to={35} />M+</strong>
              <span>{c("lp.stat1")}</span>
            </div>
            <div className="lp-stat">
              <BadgeCheck size={22} aria-hidden="true" />
              <strong><CountUp to={23} /></strong>
              <span>{c("lp.stat2")}</span>
            </div>
            <div className="lp-stat">
              <Globe2 size={22} aria-hidden="true" />
              <strong><CountUp to={4} /></strong>
              <span>{c("lp.stat3")}</span>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-pay" aria-labelledby="lp-pay-title">
          <h2 id="lp-pay-title">{c("lp.payTitle")}</h2>
          <p>{c("lp.payText")}</p>
          <ul className="lp-pay__chips">
            <li className="lp-method">Multicaixa</li>
            <li className="lp-method">PayPay</li>
            <li className="lp-method">Kwik</li>
            {COINS.map((s) => (
              <li key={s} className="lp-method lp-method--coin"><img src={`/crypto-icons/${s}.svg`} alt="" width="22" height="22" loading="lazy" />{s.toUpperCase()}</li>
            ))}
          </ul>
        </section>

        <section className="lp-wrap lp-section" aria-labelledby="lp-features">
          <h2 id="lp-features">{w("featuresTitle")}</h2>
          <div className="lp-grid">
            {FEATURES.map(([key, Icon, tone]) => (
              <article key={key} className={`lp-feature lp-feature--${tone}`}>
                <span className="lp-feature__icon"><Icon size={24} aria-hidden="true" /></span>
                <h3>{w(`features.${key}.title`)}</h3>
                <p>{w(`features.${key}.text`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-soft" aria-labelledby="lp-steps">
          <div className="lp-wrap lp-section">
            <h2 id="lp-steps">{w("stepsTitle")}</h2>
            <ol className="lp-steps">
              {(["one", "two", "three"] as const).map((k, i) => (
                <li key={k}>
                  <span className="lp-steps__n" aria-hidden="true">{i + 1}</span>
                  <h3>{w(`steps.${k}.title`)}</h3>
                  <p>{w(`steps.${k}.text`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-wrap lp-final-wrap">
          <div className="lp-final">
            <span className="lp-final__ico" aria-hidden="true"><Headphones size={22} /></span>
            <h2>{w("finalTitle")}</h2>
            <p>{w("finalText")}</p>
            <div className="lp-cta lp-cta--center">
              {authed ? (
                <a className="lp-btn lp-btn--yellow lp-btn--lg" href={DASHBOARD_URL}>{w("openAccount")}</a>
              ) : (
                <>
                  <Link className="lp-btn lp-btn--yellow lp-btn--lg" to="/register">{c("lp.create")}</Link>
                  <Link className="lp-btn lp-btn--glass lp-btn--lg" to="/login">{c("lp.signIn")}</Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__in">
          <Logo height={28} />
          <p>{w("risk")}</p>
          <div className="lp-footer__row">
            <LanguageSelect />
            <small>© {new Date().getFullYear()} KIVORA</small>
          </div>
        </div>
      </footer>
    </div>
  );
}
