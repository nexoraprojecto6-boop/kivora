import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Logo } from "../brand/index.js";
import { ApiError } from "../lib/api.js";
import { errorText } from "../lib/labels.js";
import { useAuth } from "./AuthContext.js";

export function LoginPage() {
  const { phase, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (phase === "ready") return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 401)) setError("E-mail ou palavra-passe incorrectos.");
      else setError(err instanceof ApiError ? errorText(err.code) : errorText("INTERNAL_ERROR"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit} noValidate>
        <div className="login__brand">
          <Logo height={38} />
          <span className="login__tag">Painel administrativo</span>
        </div>

        {phase === "forbidden" && (
          <div className="alert alert--danger" role="alert">
            Esta conta não tem acesso ao painel administrativo.
          </div>
        )}
        {error && (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        )}

        <label className="field">
          <span className="field__label">E-mail</span>
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Palavra-passe</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        <button className="btn btn--primary btn--block" type="submit" disabled={busy || !email || !password}>
          {busy ? "A entrar…" : "Entrar"}
        </button>
        <p className="login__hint">Acesso restrito à equipa KIVORA. Todas as acções ficam registadas na auditoria.</p>
      </form>
    </main>
  );
}
