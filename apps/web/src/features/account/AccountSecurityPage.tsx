import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { SessionSummary } from "@kivora/shared";
import { changePasswordSchema } from "@kivora/validation";
import { AppHeader } from "../../components/layout/AppHeader.js";
import { Alert } from "../../components/ui/Alert.js";
import { Button } from "../../components/ui/Button.js";
import { PasswordField } from "../../components/ui/PasswordField.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { ApiError, authApi } from "../../services/api-client.js";
import { useAuth } from "../auth/AuthContext.js";
import { formErrorKey, toErrorMap, zodToErrorMap, type FieldErrorMap } from "../auth/form-errors.js";
import { useFocusFirstError } from "../auth/useFocusFirstError.js";

const FIELD_ORDER = ["currentPassword", "newPassword"] as const;

/** Códigos específicos desta página têm texto próprio; os restantes reutilizam os de autenticação. */
function accountFieldErrorKey(code: string): string {
  if (code === "invalidCredentials") return "account.errors.wrongCurrent";
  if (code === "sameAsCurrent") return "account.errors.sameAsCurrent";
  return `auth.errors.${code}`;
}

export function AccountSecurityPage() {
  const { t, language } = useI18n();
  const { refresh } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusFirstError(errors, FIELD_ORDER, "account");

  const formatDate = useCallback(
    (iso: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)),
    [language],
  );

  /** Uma chamada que devolve 401 significa que a sessão terminou: o contexto redirecciona para o login. */
  const handleError = useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError && error.code === "UNAUTHENTICATED") void refresh();
      return t(formErrorKey(error, "register"));
    },
    [refresh, t],
  );

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await authApi.sessions());
      setLoadFailed(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "UNAUTHENTICATED") void refresh();
      setLoadFailed(true);
    }
  }, [refresh]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function revoke(id: string) {
    setNotice(null);
    setActionError(null);
    try {
      await authApi.revokeSession(id);
      setNotice(t("account.sessionRevoked"));
      await loadSessions();
    } catch (error) {
      setActionError(handleError(error));
    }
  }

  async function revokeOthers() {
    setNotice(null);
    setActionError(null);
    try {
      await authApi.revokeOtherSessions();
      setNotice(t("account.othersRevoked"));
      await loadSessions();
    } catch (error) {
      setActionError(handleError(error));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setErrors(zodToErrorMap(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await authApi.changePassword(parsed.data);
      setCurrentPassword("");
      setNewPassword("");
      setNotice(t("account.passwordChanged"));
      await loadSessions();
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.fieldErrors.length > 0) {
        setErrors(toErrorMap(error.fieldErrors));
      } else {
        setFormError(handleError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (field: string) => {
    const code = errors[field];
    return code ? t(accountFieldErrorKey(code)) : undefined;
  };
  const others = sessions?.filter((s) => !s.current) ?? [];

  return (
    <div className="dashboard">
      <AppHeader />
      <main className="dashboard__main">
        <p><Link to="/dashboard">{t("account.back")}</Link></p>
        <h1>{t("account.title")}</h1>
        {notice ? <Alert kind="success">{notice}</Alert> : null}
        {actionError ? <Alert>{actionError}</Alert> : null}

        <section className="section" aria-labelledby="sessions-title">
          <h2 id="sessions-title">{t("account.sessionsTitle")}</h2>
          <p className="field__hint">{t("account.sessionsHelp")}</p>
          {loadFailed ? <Alert>{t("account.loadFailed")}</Alert> : null}
          {sessions === null && !loadFailed ? <p role="status">{t("common.states.loading")}</p> : null}
          {sessions ? (
            <>
              <ul className="session-list">
                {sessions.map((s) => (
                  <li key={s.id} className="session-list__item">
                    <div>
                      {s.current ? <strong className="badge">{t("account.currentSession")}</strong> : null}
                      <div>{t("account.startedAt", { date: formatDate(s.createdAt) })}</div>
                      <div className="field__hint">{t("account.expiresAt", { date: formatDate(s.expiresAt) })}</div>
                    </div>
                    {s.current ? null : (
                      <Button
                        variant="danger"
                        aria-label={t("account.revokeLabel", { date: formatDate(s.createdAt) })}
                        onClick={() => void revoke(s.id)}
                      >
                        {t("account.revoke")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {others.length > 0 ? (
                <Button variant="danger" onClick={() => void revokeOthers()}>{t("account.revokeOthers")}</Button>
              ) : (
                <p className="field__hint">{t("account.noOtherSessions")}</p>
              )}
            </>
          ) : null}
        </section>

        <section className="section" aria-labelledby="password-title">
          <h2 id="password-title">{t("account.passwordTitle")}</h2>
          <form onSubmit={(e) => void onSubmit(e)} noValidate className="form">
            {formError ? <Alert>{formError}</Alert> : null}
            {Object.keys(errors).length > 0 ? <Alert>{t("auth.errors.formSummary")}</Alert> : null}
            <PasswordField
              id="account-currentPassword"
              label={t("account.currentPassword")}
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              error={fieldError("currentPassword")}
            />
            <PasswordField
              id="account-newPassword"
              label={t("account.newPassword")}
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              hint={t("account.newPasswordHint")}
              error={fieldError("newPassword")}
            />
            <Button type="submit" busy={busy}>
              {busy ? t("account.changing") : t("account.changePassword")}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
