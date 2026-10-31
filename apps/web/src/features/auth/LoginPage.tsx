import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { loginSchema } from "@kivora/validation";
import { Alert } from "../../components/ui/Alert.js";
import { AuthLayout } from "../../components/layout/AuthLayout.js";
import { Button } from "../../components/ui/Button.js";
import { PasswordField } from "../../components/ui/PasswordField.js";
import { TextField } from "../../components/ui/TextField.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { ApiError } from "../../services/api-client.js";
import { useCopy } from "../verify/copy.js";
import { useAuth } from "./AuthContext.js";
import { RedirectToDashboard } from "./RedirectToDashboard.js";
import { fieldErrorKey, formErrorKey, toErrorMap, zodToErrorMap, type FieldErrorMap } from "./form-errors.js";
import { useFocusFirstError } from "./useFocusFirstError.js";

const FIELD_ORDER = ["email", "password"] as const;

export function LoginPage() {
  const { t } = useI18n();
  const c = useCopy();
  const { status, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusFirstError(errors, FIELD_ORDER, "login");

  if (status === "authenticated") return <RedirectToDashboard />;

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
    <AuthLayout title={t("auth.login.title")} subtitle={c("l.subtitle")} icon={LogIn}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="form">
        {formError ? <Alert>{formError}</Alert> : null}
        {Object.keys(errors).length > 0 ? <Alert>{t("auth.errors.formSummary")}</Alert> : null}
        <TextField
          id="login-email"
          label={t("auth.login.email")}
          type="email"
          autoComplete="username"
          placeholder={t("auth.login.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError("email")}
        />
        <div className="au-passrow">
          <PasswordField
            id="login-password"
            label={t("auth.login.password")}
            autoComplete="current-password"
            placeholder={t("auth.login.passwordPlaceholder")}
            value={password}
            onChange={setPassword}
            error={fieldError("password")}
          />
          <Link to="/forgot-password" className="au-forgot">{t("auth.login.forgotPassword")}</Link>
        </div>
        <Button type="submit" busy={busy} className="au-submit">
          {busy ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>
      <div className="au-divider" role="separator"><span>{c("l.or")}</span></div>
      <p className="au-alt">
        {t("auth.login.noAccount")} <Link to="/register">{t("auth.login.createAccount")}</Link>
      </p>
    </AuthLayout>
  );
}
