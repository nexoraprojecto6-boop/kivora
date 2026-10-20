import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { registerSchema } from "@kivora/validation";
import { Alert } from "../../components/ui/Alert.js";
import { Button } from "../../components/ui/Button.js";
import { Checkbox } from "../../components/ui/Checkbox.js";
import { TextField } from "../../components/ui/TextField.js";
import { AuthLayout } from "../../components/layout/AuthLayout.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { ApiError } from "../../services/api-client.js";
import { useAuth } from "./AuthContext.js";
import { fieldErrorKey, formErrorKey, toErrorMap, zodToErrorMap, type FieldErrorMap } from "./form-errors.js";
import { useFocusFirstError } from "./useFocusFirstError.js";

const FIELD_ORDER = ["fullName", "email", "password", "countryOfResidence", "acceptTerms", "acceptPrivacy"] as const;

/** Os campos do registo são provisórios (decisões 4 e 6 em docs/compliance). */
export function RegisterPage() {
  const { t } = useI18n();
  const { status, register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useFocusFirstError(errors, FIELD_ORDER, "register");

  if (status === "authenticated") return <Navigate to="/dashboard" replace />;

  const fieldError = (field: string) => {
    const code = errors[field];
    return code ? t(fieldErrorKey(code)) : undefined;
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse({
      fullName,
      email,
      password,
      countryOfResidence: country,
      acceptTerms,
      acceptPrivacy,
    });
    if (!parsed.success) {
      setErrors(zodToErrorMap(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await register(parsed.data);
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.fieldErrors.length > 0) {
        setErrors(toErrorMap(error.fieldErrors));
      } else {
        setFormError(t(formErrorKey(error, "register")));
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title={t("auth.register.successTitle")}>
        <p role="status">{t("auth.register.successBody")}</p>
        <Link to="/login" className="button button--primary">{t("auth.register.goToLogin")}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.register.title")}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="form">
        {formError ? <Alert>{formError}</Alert> : null}
        {Object.keys(errors).length > 0 ? <Alert>{t("auth.errors.formSummary")}</Alert> : null}
        <TextField
          id="register-fullName"
          label={t("auth.register.fullName")}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fieldError("fullName")}
        />
        <TextField
          id="register-email"
          label={t("auth.register.email")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError("email")}
        />
        <TextField
          id="register-password"
          label={t("auth.register.password")}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t("auth.register.passwordHint")}
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
        <TextField
          id="register-countryOfResidence"
          label={t("auth.register.countryOfResidence")}
          autoComplete="country"
          maxLength={2}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          hint={t("auth.register.countryHint")}
          error={fieldError("countryOfResidence")}
        />
        <Checkbox
          id="register-acceptTerms"
          label={t("auth.register.acceptTerms")}
          checked={acceptTerms}
          onChange={setAcceptTerms}
          error={fieldError("acceptTerms")}
        />
        <Checkbox
          id="register-acceptPrivacy"
          label={t("auth.register.acceptPrivacy")}
          checked={acceptPrivacy}
          onChange={setAcceptPrivacy}
          error={fieldError("acceptPrivacy")}
        />
        <Button type="submit" busy={busy}>
          {busy ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>
      </form>
      <p className="card__footer">
        {t("auth.register.haveAccount")} <Link to="/login">{t("auth.register.signIn")}</Link>
      </p>
    </AuthLayout>
  );
}
