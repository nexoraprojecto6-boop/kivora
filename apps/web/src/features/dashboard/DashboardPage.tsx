import { useI18n } from "../../i18n/I18nProvider.js";
import { LanguageSelect } from "../../components/layout/LanguageSelect.js";
import { Button } from "../../components/ui/Button.js";
import { useAuth } from "../auth/AuthContext.js";

/**
 * Início do cliente. Mostra apenas dados reais devolvidos pela API.
 * Não há saldos, planos nem estatísticas: esses módulos ainda não existem.
 */
export function DashboardPage() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="dashboard">
      <header className="auth-layout__header">
        <span className="brand">{t("common.app.name")}</span>
        <div className="header-actions">
          <LanguageSelect />
          <Button variant="secondary" onClick={() => void logout()}>{t("common.actions.logout")}</Button>
        </div>
      </header>
      <main className="dashboard__main">
        <h1>{t("dashboard.greeting", { name: user.fullName })}</h1>
        <dl className="status-list">
          <div>
            <dt>{t("dashboard.accountStatus")}</dt>
            <dd>{t(`dashboard.status.${user.status}`)}</dd>
          </div>
          <div>
            <dt>{t("dashboard.emailStatus")}</dt>
            <dd>{user.emailVerified ? t("dashboard.emailVerified") : t("dashboard.emailNotVerified")}</dd>
          </div>
        </dl>
        <section className="empty-state">
          <h2>{t("dashboard.emptyTitle")}</h2>
          <p>{t("dashboard.emptyBody")}</p>
        </section>
      </main>
    </div>
  );
}
