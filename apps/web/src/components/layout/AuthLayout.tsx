import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, type LucideIcon } from "lucide-react";
import { Logo } from "../../brand/index.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { useCopy } from "../../features/verify/copy.js";
import { LanguageSelect } from "./LanguageSelect.js";

interface AuthLayoutProps {
  title: string;
  /** Frase curta por baixo do título. */
  subtitle?: string;
  /** Ícone no topo do cartão (opcional). */
  icon?: LucideIcon;
  children: ReactNode;
}

/**
 * Estrutura das páginas de acesso: cabeçalho com logótipo e idioma, e um cartão centrado
 * (na horizontal e na vertical) sobre um fundo suave. Em ecrãs pequenos o cartão ocupa a largura toda.
 */
export function AuthLayout({ title, subtitle, icon: Icon, children }: AuthLayoutProps) {
  const { t } = useI18n();
  const c = useCopy();
  return (
    <div className="auth-layout">
      <header className="auth-layout__header">
        <Link to="/" className="brand-link" aria-label={t("common.app.name")}><Logo height={30} /></Link>
        <LanguageSelect />
      </header>
      <main className="auth-layout__main">
        <div className="au-wrap">
          <section className="card au-card">
            <div className="au-head">
              {Icon ? <span className="au-icon" aria-hidden="true"><Icon size={26} /></span> : null}
              <h1 className="card__title au-title">{title}</h1>
              {subtitle ? <p className="au-subtitle">{subtitle}</p> : null}
            </div>
            {children}
          </section>
          <p className="au-secure"><ShieldCheck size={15} aria-hidden="true" /> {c("l.secure")}</p>
        </div>
      </main>
    </div>
  );
}
