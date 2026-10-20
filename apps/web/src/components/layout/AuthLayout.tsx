import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider.js";
import { LanguageSelect } from "./LanguageSelect.js";

/** Estrutura das páginas de acesso. O selector de idioma fica no canto superior direito. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="auth-layout">
      <header className="auth-layout__header">
        <span className="brand">{t("common.app.name")}</span>
        <LanguageSelect />
      </header>
      <main className="auth-layout__main">
        <section className="card">
          <h1 className="card__title">{title}</h1>
          {children}
        </section>
      </main>
    </div>
  );
}
