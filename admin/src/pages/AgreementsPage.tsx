import { Plus } from "lucide-react";
import { useState } from "react";
import { DataState, Empty } from "../components/ui/DataState.js";
import { Modal } from "../components/ui/Modal.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi, ApiError, type AgreementRow } from "../lib/api.js";
import { formatDateTime } from "../lib/format.js";
import { errorText } from "../lib/labels.js";
import { useAsync } from "../lib/useAsync.js";

export function AgreementsPage() {
  const q = useAsync(() => adminApi.agreements(), []);
  const [editing, setEditing] = useState<{ code: string; title: string; body: string } | null>(null);
  const [view, setView] = useState<AgreementRow | null>(null);

  return (
    <>
      <PageHeader
        title="Acordos e termos"
        subtitle="Cada alteração publica uma nova versão; quem aceitou a anterior tem de aceitar a nova."
        actions={<button className="btn btn--primary" type="button" onClick={() => setEditing({ code: "", title: "", body: "" })}><Plus size={16} /> Novo acordo</button>}
      />
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Ainda não há acordos publicados.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Código</th><th>Título</th><th>Versão</th><th>Publicado em</th><th className="right">Aceites</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.versionId}>
                      <td className="mono">{a.code}</td>
                      <td>{a.title}</td>
                      <td>v{a.version}</td>
                      <td className="nowrap">{formatDateTime(a.publishedAt)}</td>
                      <td className="right">{a.acceptances}</td>
                      <td className="right">
                        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                          <button className="btn btn--ghost btn--sm" type="button" onClick={() => setView(a)}>Ver</button>
                          <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditing({ code: a.code, title: a.title, body: a.body })}>Nova versão</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataState>
      {view && (
        <Modal wide title={`${view.title} (v${view.version})`} onClose={() => setView(null)}>
          <div className="modal__text" style={{ whiteSpace: "pre-wrap" }}>{view.body}</div>
        </Modal>
      )}
      {editing && <AgreementEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); q.reload(); }} />}
    </>
  );
}

function AgreementEditor({ initial, onClose, onSaved }: { initial: { code: string; title: string; body: string }; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNewVersion = initial.code !== "";
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[a-z][a-z0-9-]{1,39}$/.test(f.code) && f.title.trim().length >= 2 && f.body.trim().length >= 1;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi.publishAgreement({ code: f.code, title: f.title.trim(), body: f.body.trim() });
      toast.success(`Versão ${r.version} publicada.`);
      onSaved();
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={isNewVersion ? `Nova versão — ${initial.code}` : "Novo acordo"}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn btn--primary" type="button" onClick={() => void save()} disabled={busy || !valid}>{busy ? "A publicar…" : "Publicar"}</button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Código</span>
          <input className="input" value={f.code} disabled={isNewVersion} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="ex.: termos-investimento" />
          <span className="field__hint">Minúsculas, números e hífens (2 a 40 caracteres). Não muda entre versões.</span>
        </label>
        <label className="field"><span className="field__label">Título</span><input className="input" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="field full"><span className="field__label">Texto</span><textarea className="input" rows={14} maxLength={60000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      </div>
      <div className="alert alert--warning">Ao publicar, todos os clientes terão de aceitar esta nova versão. Reveja o texto com o seu jurista antes.</div>
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
    </Modal>
  );
}
