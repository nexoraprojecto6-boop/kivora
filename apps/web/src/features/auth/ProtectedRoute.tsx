import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider.js";
import { useAuth } from "./AuthContext.js";

/** Só uma conveniência de navegação: a autorização real é sempre verificada no backend. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { t } = useI18n();
  if (status === "loading") return <p role="status" className="page-status">{t("common.states.loading")}</p>;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <>{children}</>;
}
