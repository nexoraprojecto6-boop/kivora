import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { loginSchema } from "@kivora/validation";
import { Alert } from "../../components/ui/Alert.js";
import { Button } from "../../components/ui/Button.js";
import { TextField } from "../../components/ui/TextField.js";
import { AuthLayout } from "../../components/layout/AuthLayout.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { ApiError } from "../../services/api-client.js";
import { useAuth } from "./AuthContext.js";
import { fieldErrorKey, formErrorKey, toErrorMap, zodToErrorMap, type FieldErrorMap } from "./form-errors.js";
import { useFocusFirstError } from "./useFocusFirstError.js";

const FIELD_ORDER = ["email", "password"] as const;

export function LoginPage() {
  const { t } = useI18n();
  const { status, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusFirstError(errors, FIELD_ORDER, "login");

  if (status === "authenticated") return <Navigate to="/dashboard" replace />;

  const fieldError = (field: string) => {
    const code = errors[field];
    return code ? t(fieldErrorKey(code)) : undefined;
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(zodToErrorMap(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await login(parsed.data); // ao entrar, o estado muda e a página redirecciona
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.fieldErrors.length > 0) {
        setErrors(toErrorMap(error.fieldErrors));
      } else {
        setFormError(t(formErrorKey(error, "login")));
      }
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t("auth.login.title")}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="form">
        {formError ? <Alert>{formError}</Alert> : null}
        {Object.keys(errors).length > 0 ? <Alert>{t("auth.errors.formSummary")}</Alert> : null}
        <TextField
          id="login-email"
          label={t("auth.login.email")}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError("email")}
        />
        <TextField
          id="login-password"
          label={t("auth.login.password")}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError("password")}
          trailing={
            <button
              type="button"
              className="field__toggle"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? t("common.actions.hidePassword") : t("common.actions.showPassword")}
            </button>
          }
        />
        <Button type="submit" busy={busy}>
          {busy ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>
      <p className="card__footer">
        {t("auth.login.noAccount")} <Link to="/register">{t("auth.login.createAccount")}</Link>
      </p>
    </AuthLayout>
  );
}
