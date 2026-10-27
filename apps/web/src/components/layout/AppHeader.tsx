import { Logo } from "../../brand/index.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { useAuth } from "../../features/auth/AuthContext.js";
import { Button } from "../ui/Button.js";
import { LanguageSelect } from "./LanguageSelect.js";

/** Cabeçalho das páginas com sessão iniciada. */
export function AppHeader() {
  const { t } = useI18n();
  const { logout } = useAuth();
  return (
    <header className="auth-layout__header">
      <span aria-label={t("common.app.name")}><Logo height={30} onDark /></span>
      <div className="header-actions">
        <LanguageSelect />
        <Button variant="secondary" onClick={() => void logout()}>{t("common.actions.logout")}</Button>
      </div>
    </header>
  );
}
