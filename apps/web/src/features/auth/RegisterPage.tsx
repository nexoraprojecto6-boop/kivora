import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema } from "@kivora/validation";
import { Alert } from "../../components/ui/Alert.js";
import { Button } from "../../components/ui/Button.js";
import { Checkbox } from "../../components/ui/Checkbox.js";
import { CountrySelect } from "../../components/ui/CountrySelect.js";
import { PasswordField } from "../../components/ui/PasswordField.js";
import { TextField } from "../../components/ui/TextField.js";
import { AuthLayout } from "../../components/layout/AuthLayout.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { ApiError, authApi } from "../../services/api-client.js";
import { useCopy } from "../verify/copy.js";
import { useAuth } from "./AuthContext.js";
import { RedirectToDashboard } from "./RedirectToDashboard.js";
import { fieldErrorKey, formErrorKey, toErrorMap, zodToErrorMap, type FieldErrorMap } from "./form-errors.js";
import { useFocusFirstError } from "./useFocusFirstError.js";

const FIELD_ORDER = ["fullName", "email", "password", "countryOfResidence", "acceptTerms", "acceptPrivacy"] as const;

/**
 * Registo: nome, email, palavra-passe (com olho dentro do campo), país (lista com nomes) e consentimentos.
 * Ao criar a conta abre-se sessão e o utilizador segue para /verify (email → documentos).
 */
export function RegisterPage() {
  const { t } = useI18n();
  const c = useCopy();
  const navigate = useNavigate();
  const { status, register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Evita enviar para o painel no instante em que a sessão se abre: quem acabou de se registar vai para /verify. */
  const justRegistered = useRef(false);

  useFocusFirstError(errors, FIELD_ORDER, "register");

  if (status === "authenticated" && !justRegistered.current) return <RedirectToDashboard />;

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
    justRegistered.current = true;
    try {
      await register(parsed.data);
      // Envia já o código de confirmação; se falhar, o passo seguinte oferece "Enviar código".
      const sent = await authApi.sendEmailCode().then(() => true, () => false);
      navigate("/verify", { replace: true, state: { sent } });
    } catch (error) {
      justRegistered.current = false;
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.fieldErrors.length > 0) {
        setErrors(toErrorMap(error.fieldErrors));
      } else {
        setFormError(t(formErrorKey(error, "register")));
      }
    } finally {
      setBusy(false);
    }
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
          placeholder={c("reg.fullNamePh")}
          hint={c("reg.fullNameHint")}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fieldError("fullName")}
        />
        <TextField
          id="register-email"
          label={t("auth.register.email")}
          type="email"
          autoComplete="email"
          placeholder={c("reg.emailPh")}
          hint={c("reg.emailHint")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError("email")}
        />
        <PasswordField
          id="register-password"
          label={t("auth.register.password")}
          autoComplete="new-password"
          placeholder={c("reg.passwordPh")}
          hint={c("reg.passwordHint")}
          value={password}
          onChange={setPassword}
          error={fieldError("password")}
        />
        <CountrySelect
          id="register-countryOfResidence"
          label={t("auth.register.countryOfResidence")}
          value={country}
          onChange={setCountry}
          placeholder={c("reg.countryPh")}
          commonLabel={c("reg.common")}
          allLabel={c("reg.all")}
          hint={c("reg.countryHint")}
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
