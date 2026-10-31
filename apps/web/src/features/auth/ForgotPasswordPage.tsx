import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, KeyRound, MailCheck } from "lucide-react";
import { Alert } from "../../components/ui/Alert.js";
import { AuthLayout } from "../../components/layout/AuthLayout.js";
import { Button } from "../../components/ui/Button.js";
import { PasswordField } from "../../components/ui/PasswordField.js";
import { TextField } from "../../components/ui/TextField.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { ApiError, authApi } from "../../services/api-client.js";
import { useCopy } from "../verify/copy.js";
import { PASSWORD_MIN_LENGTH } from "@kivora/validation";

type Step = 1 | 2 | 3;
type Copy = ReturnType<typeof useCopy>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorText(c: Copy, error: unknown): string {
  if (!(error instanceof ApiError)) return c("e.generic");
  const field = error.fieldErrors[0];
  if (field?.code === "invalidCode") return c("e.invalidCode");
  if (field?.code === "expiredCode") return c("e.expiredCode");
  if (error.code === "RATE_LIMITED") return c("e.tooMany");
  if (error.code === "NETWORK") return c("e.network");
  return c("e.generic");
}

function Steps({ current }: { current: Step }) {
  const c = useCopy();
  const items = [c("f.stepEmail"), c("f.stepCode"), c("f.stepDone")];
  return (
    <ol className="vf-steps" aria-label={c("f.title1")}>
      {items.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={label} className={`vf-step vf-step--${state}`} aria-current={n === current ? "step" : undefined}>
            <span className="vf-step__dot">{n < current || current === 3 ? <Check size={14} aria-hidden="true" /> : n}</span>
            <span className="vf-step__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Recuperar palavra-passe, em 3 passos na mesma página (/forgot-password):
 * 1) email → envia o código de 6 dígitos; 2) código + nova palavra-passe; 3) concluído.
 */
export function ForgotPasswordPage() {
  const { t } = useI18n();
  const c = useCopy();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passError, setPassError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setEmailError(t("auth.errors.invalidEmail"));
      return;
    }
    setEmailError(undefined);
    setBusy(true);
    try {
      await authApi.forgotPassword(clean);
      setEmail(clean);
      setCooldown(60);
      setStep(2);
    } catch (e) {
      setError(errorText(c, e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setCooldown(60);
    } catch (e) {
      setError(errorText(c, e));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPassError(undefined);
    setConfirmError(undefined);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setPassError(t("auth.errors.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setConfirmError(c("f.mismatch"));
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword({ email, code, newPassword: password });
      setPassword("");
      setConfirm("");
      setStep(3);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors[0]?.field === "newPassword") setPassError(t("auth.errors.passwordTooShort"));
      else setError(errorText(c, e));
    } finally {
      setBusy(false);
    }
  }

  if (step === 3) {
    return (
      <AuthLayout title={c("f.title3")} icon={Check}>
        <Steps current={3} />
        <Alert kind="success">{c("f.done")}</Alert>
        <Button type="button" className="au-submit" onClick={() => navigate("/login", { replace: true })}>{c("f.toLogin")}</Button>
      </AuthLayout>
    );
  }

  if (step === 2) {
    return (
      <AuthLayout title={c("f.title2")} icon={KeyRound}>
        <Steps current={2} />
        <form onSubmit={(e) => void submitReset(e)} noValidate className="form">
          <p className="vf-lead"><MailCheck size={18} aria-hidden="true" /> {c("f.sentTo", { email })}</p>
          {error ? <Alert>{error}</Alert> : null}
          <TextField
            id="reset-code"
            label={c("f.code")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            hint={c("f.codeHint")}
          />
          <PasswordField
            id="reset-password"
            label={c("f.newPass")}
            autoComplete="new-password"
            placeholder={c("f.newPassPh")}
            hint={c("reg.passwordHint")}
            value={password}
            onChange={setPassword}
            error={passError}
          />
          <PasswordField
            id="reset-confirm"
            label={c("f.confirmPass")}
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            error={confirmError}
          />
          <Button type="submit" busy={busy} disabled={code.length !== 6 || !password || !confirm} className="au-submit">
            {busy ? c("f.resetting") : c("f.reset")}
          </Button>
          <Button type="button" variant="secondary" disabled={busy || cooldown > 0} onClick={() => void resend()}>
            {cooldown > 0 ? c("f.resendIn", { s: String(cooldown) }) : c("f.resend")}
          </Button>
          <button type="button" className="au-link" onClick={() => { setStep(1); setCode(""); setError(null); }}>
            {c("f.changeEmail")}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={c("f.title1")} subtitle={c("f.lead1")} icon={KeyRound}>
      <Steps current={1} />
      <form onSubmit={(e) => void requestCode(e)} noValidate className="form">
        {error ? <Alert>{error}</Alert> : null}
        <TextField
          id="forgot-email"
          label={t("auth.login.email")}
          type="email"
          autoComplete="username"
          placeholder={t("auth.login.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <Button type="submit" busy={busy} className="au-submit">{busy ? c("f.sending") : c("f.sendCode")}</Button>
      </form>
      <p className="au-alt">
        <Link to="/login" className="au-back"><ArrowLeft size={15} aria-hidden="true" /> {c("f.back")}</Link>
      </p>
    </AuthLayout>
  );
}
