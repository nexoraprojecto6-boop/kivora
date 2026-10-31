import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Camera, Check, MailCheck } from "lucide-react";
import type { VerificationDocType, VerificationDto, VerificationFileKind } from "@kivora/shared";
import { AuthLayout } from "../../components/layout/AuthLayout.js";
import { Alert } from "../../components/ui/Alert.js";
import { Button } from "../../components/ui/Button.js";
import { CountrySelect } from "../../components/ui/CountrySelect.js";
import { TextField } from "../../components/ui/TextField.js";
import { ApiError, authApi, platformApi } from "../../services/api-client.js";
import { DASHBOARD_URL, redirectTo } from "../../services/navigation.js";
import { markVerificationSubmitted } from "../../services/verification-notice.js";
import { useAuth } from "../auth/AuthContext.js";
import { useCopy } from "./copy.js";
import { prepareImage } from "./image.js";

type Copy = ReturnType<typeof useCopy>;

function errorText(c: Copy, error: unknown): string {
  if (!(error instanceof ApiError)) return c("e.generic");
  const field = error.fieldErrors[0];
  if (field?.code === "invalidCode") return c("e.invalidCode");
  if (field?.code === "expiredCode") return c("e.expiredCode");
  if (field?.code === "notVerified") return c("e.notVerified");
  if (field?.code === "required" || field?.code === "backRequired") return c("e.required");
  if (error.code === "RATE_LIMITED") return c("e.tooMany");
  if (error.code === "NETWORK") return c("e.network");
  if (error.code === "SERVICE_UNAVAILABLE") return c("e.mail");
  return c("e.generic");
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const c = useCopy();
  const items = [c("v.step1"), c("v.step2"), c("v.step3")];
  return (
    <ol className="vf-steps" aria-label={c("v.title")}>
      {items.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={label} className={`vf-step vf-step--${state}`} aria-current={n === current ? "step" : undefined}>
            <span className="vf-step__dot">{n < current ? <Check size={14} aria-hidden="true" /> : n}</span>
            <span className="vf-step__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Passo 1: email ---------------- */

function EmailStep({ email, alreadySent, onVerified }: { email: string; alreadySent: boolean; onVerified: () => void }) {
  const c = useCopy();
  const [sent, setSent] = useState(alreadySent);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(alreadySent ? 60 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const already = await authApi.sendEmailCode();
      if (already) return onVerified();
      setSent(true);
      setCooldown(60);
    } catch (e) {
      if (e instanceof ApiError && e.code === "RATE_LIMITED") {
        setSent(true);
        setCooldown(60);
      }
      setError(errorText(c, e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await authApi.verifyEmailCode(code.trim());
      onVerified();
    } catch (e) {
      setError(errorText(c, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <p className="vf-lead"><MailCheck size={18} aria-hidden="true" /> {c(sent ? "v.emailSent" : "v.emailAsk", { email })}</p>
      {error ? <Alert>{error}</Alert> : null}
      {sent ? (
        <>
          <TextField
            id="verify-code"
            label={c("v.codeLabel")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            hint={c("v.codeHint")}
            style={{ letterSpacing: "0.35em", textAlign: "center", fontSize: "1.25rem" }}
          />
          <Button type="button" busy={busy} disabled={code.length !== 6} onClick={() => void confirm()}>
            {busy ? c("v.confirming") : c("v.confirm")}
          </Button>
          <Button type="button" variant="secondary" disabled={busy || cooldown > 0} onClick={() => void send()}>
            {cooldown > 0 ? c("v.resendIn", { s: String(cooldown) }) : c("v.resend")}
          </Button>
        </>
      ) : (
        <Button type="button" busy={busy} onClick={() => void send()}>{busy ? c("v.sending") : c("v.send")}</Button>
      )}
    </div>
  );
}

/* ---------------- Passo 2: documentos ---------------- */

function PhotoPicker({ kind, label, hint, file, onPick, capture }: {
  kind: VerificationFileKind; label: string; hint: string; file: File | undefined;
  onPick: (kind: VerificationFileKind, file: File | undefined) => void; capture?: "user" | "environment";
}) {
  const c = useCopy();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const id = `verify-${kind.toLowerCase()}`;
  return (
    <div className="field">
      <span className="field__label" id={`${id}-label`}>{label}</span>
      <label className={`vf-photo${file ? " vf-photo--filled" : ""}`} htmlFor={id}>
        {preview ? <img src={preview} alt="" className="vf-photo__img" /> : <Camera size={26} aria-hidden="true" />}
        <span className="vf-photo__action">{file ? c("v.change") : c("v.take")}</span>
        <input
          id={id}
          type="file"
          accept="image/*"
          {...(capture ? { capture } : {})}
          aria-labelledby={`${id}-label`}
          className="vf-photo__input"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onPick(kind, e.target.files?.[0])}
        />
      </label>
      <p className="field__hint">{hint}</p>
    </div>
  );
}

function DocsStep({ defaultCountry, previous, onSubmitted }: { defaultCountry: string; previous: VerificationDto | null; onSubmitted: (s: VerificationDto) => void }) {
  const c = useCopy();
  const [docType, setDocType] = useState<VerificationDocType>("ID_CARD");
  const [country, setCountry] = useState(defaultCountry);
  const [files, setFiles] = useState<Partial<Record<VerificationFileKind, File>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsBack = docType !== "PASSPORT";

  const pick = useCallback((kind: VerificationFileKind, file: File | undefined) => {
    setError(null);
    if (file && !file.type.startsWith("image/")) return setError(c("e.notImage"));
    setFiles((p) => {
      const next = { ...p };
      if (file) next[kind] = file;
      else delete next[kind];
      return next;
    });
  }, [c]);

  const ready = Boolean(files.FRONT && files.SELFIE && country && (!needsBack || files.BACK));

  async function submit() {
    if (!ready) return setError(c("e.required"));
    setBusy(true);
    setError(null);
    try {
      const kinds: VerificationFileKind[] = needsBack ? ["FRONT", "BACK", "SELFIE"] : ["FRONT", "SELFIE"];
      const payload = await Promise.all(
        kinds.map(async (kind) => ({ kind, ...(await prepareImage(files[kind] as File)) })),
      );
      const { submission } = await platformApi.submitVerification({ docType, issuingCountry: country, files: payload });
      onSubmitted(submission);
    } catch (e) {
      setError(e instanceof ApiError ? errorText(c, e) : c("e.notImage"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <p className="vf-lead">{c("v.docsBody")}</p>
      {previous?.status === "REJECTED" ? (
        <Alert>{previous.rejectionReason ? c("v.rejectedBody", { reason: previous.rejectionReason }) : c("v.rejectedNoReason")}</Alert>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      <fieldset className="vf-doctypes">
        <legend className="field__label">{c("v.docType")}</legend>
        {(["ID_CARD", "PASSPORT", "RESIDENCE_PERMIT"] as const).map((k) => (
          <label key={k} className={`vf-doctype${docType === k ? " vf-doctype--on" : ""}`}>
            <input type="radio" name="docType" value={k} checked={docType === k} onChange={() => setDocType(k)} />
            {c(`v.doc.${k}`)}
          </label>
        ))}
      </fieldset>
      <CountrySelect
        id="verify-country"
        label={c("v.issuing")}
        value={country}
        onChange={setCountry}
        placeholder={c("reg.countryPh")}
        commonLabel={c("reg.common")}
        allLabel={c("reg.all")}
      />
      <PhotoPicker kind="FRONT" label={c("v.front")} hint={c("v.frontHint")} file={files.FRONT} onPick={pick} />
      {needsBack ? <PhotoPicker kind="BACK" label={c("v.back")} hint={c("v.backHint")} file={files.BACK} onPick={pick} /> : null}
      <PhotoPicker kind="SELFIE" label={c("v.selfie")} hint={c("v.selfieHint")} file={files.SELFIE} onPick={pick} capture="user" />
      <Button type="button" busy={busy} disabled={!ready} onClick={() => void submit()}>
        {busy ? c("v.submitting") : c("v.submit")}
      </Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => redirectTo(DASHBOARD_URL)}>{c("v.later")}</Button>
    </div>
  );
}

/* ---------------- Página ---------------- */

export function VerifyPage() {
  const c = useCopy();
  const { status, user, refresh } = useAuth();
  const location = useLocation();
  const alreadySent = (location.state as { sent?: boolean } | null)?.sent === true;
  const [sub, setSub] = useState<VerificationDto | null | undefined>(undefined);
  const loaded = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !user?.emailVerified || loaded.current) return;
    loaded.current = true;
    platformApi.verification().then(setSub).catch(() => setSub(null));
  }, [status, user?.emailVerified]);

  if (status === "loading") return null;
  if (status === "anonymous" || !user) return <Navigate to="/login" replace />;

  if (!user.emailVerified) {
    return (
      <AuthLayout title={c("v.emailTitle")}>
        <Steps current={1} />
        <EmailStep email={user.email} alreadySent={alreadySent} onVerified={() => void refresh()} />
      </AuthLayout>
    );
  }
  if (sub === undefined) return null;

  if (sub && (sub.status === "PENDING" || sub.status === "APPROVED")) {
    const approved = sub.status === "APPROVED";
    return (
      <AuthLayout title={c(approved ? "v.approvedTitle" : "v.pendingTitle")}>
        <Steps current={3} />
        <p role="status" className="vf-lead">{c(approved ? "v.approvedBody" : "v.pendingBody")}</p>
        <Button type="button" onClick={() => redirectTo(DASHBOARD_URL)}>{c("v.dashboard")}</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={c(sub?.status === "REJECTED" ? "v.rejectedTitle" : "v.docsTitle")}>
      <Steps current={2} />
      <DocsStep defaultCountry={user.countryOfResidence} previous={sub ?? null}
        onSubmitted={() => {
          // Documentos enviados: segue para o painel, onde aparece o aviso «Conta em verificação».
          markVerificationSubmitted();
          redirectTo(DASHBOARD_URL);
        }}
      />
    </AuthLayout>
  );
}
