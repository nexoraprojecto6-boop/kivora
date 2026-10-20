import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider.js";
import { AppHeader } from "../../components/layout/AppHeader.js";
import { useAuth } from "../auth/AuthContext.js";

/**
 * Início do cliente. Mostra apenas dados reais devolvidos pela API.
 * Não há saldos, planos nem estatísticas: esses módulos ainda não existem.
 */
export function DashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="dashboard">
      <AppHeader />
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
        <p>
          <Link to="/account/security">{t("dashboard.securityLink")}</Link>
        </p>
        <section className="empty-state">
          <h2>{t("dashboard.emptyTitle")}</h2>
          <p>{t("dashboard.emptyBody")}</p>
        </section>
      </main>
    </div>
  );
}
