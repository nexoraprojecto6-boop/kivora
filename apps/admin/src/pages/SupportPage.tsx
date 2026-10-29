import type { AdminTicketDetailDto, AdminTicketDto } from "@kivora/shared";
import { useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { Modal } from "../components/ui/Modal.js";
import { FilterTabs, PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi, ApiError } from "../lib/api.js";
import { formatDateTime } from "../lib/format.js";
import { CATEGORY_LABEL, errorText } from "../lib/labels.js";
import { useAsync } from "../lib/useAsync.js";

const TABS = [
  { value: "OPEN", label: "Abertos" },
  { value: "ANSWERED", label: "Respondidos" },
  { value: "CLOSED", label: "Fechados" },
  { value: "", label: "Todos" },
];

export function SupportPage() {
  const [status, setStatus] = useState("OPEN");
  const [open, setOpen] = useState<AdminTicketDto | null>(null);
  const q = useAsync(() => adminApi.tickets(status || undefined), [status]);

  return (
    <>
      <PageHeader title="Suporte" subtitle="Responda aos pedidos dos clientes." />
      <FilterTabs value={status} onChange={setStatus} options={TABS} />
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Sem tickets neste estado.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Assunto</th><th>Cliente</th><th>Categoria</th><th>Última actividade</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="row-click" onClick={() => setOpen(t)}>
                      <td>{t.subject}</td>
                      <td><span className="cell-main">{t.userName}<small>{t.userEmail}</small></span></td>
                      <td>{CATEGORY_LABEL[t.category] ?? t.category}</td>
                      <td className="nowrap">{formatDateTime(t.updatedAt)}</td>
                      <td><Badge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataState>
      {open && <TicketModal id={open.id} onClose={() => { setOpen(null); q.reload(); }} />}
    </>
  );
}

function TicketModal({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const q = useAsync(() => adminApi.ticket(id), [id]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<AdminTicketDetailDto>, ok: string, clear = false) {
    setBusy(true);
    try {
      q.setData(await fn());
      if (clear) setText("");
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
    } finally {
      setBusy(false);
    }
  }

  const t = q.data;
  return (
    <Modal
      wide
      title={t ? t.subject : "Ticket"}
      onClose={onClose}
      footer={
        t && t.status !== "CLOSED" ? (
          <>
            <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => void run(() => adminApi.closeTicket(id), "Ticket fechado.")}>Fechar ticket</button>
            <button className="btn btn--primary" type="button" disabled={busy || !text.trim()} onClick={() => void run(() => adminApi.replyTicket(id, text.trim()), "Resposta enviada.", true)}>Enviar resposta</button>
          </>
        ) : (
          <button className="btn btn--ghost" type="button" onClick={onClose}>Fechar</button>
        )
      }
    >
      <DataState q={q}>
        {(d) => (
          <>
            <dl className="kv">
              <dt>Cliente</dt><dd>{d.userName} — <span className="muted">{d.userEmail}</span></dd>
              <dt>Categoria</dt><dd>{CATEGORY_LABEL[d.category] ?? d.category}</dd>
              <dt>Estado</dt><dd><Badge status={d.status} /></dd>
            </dl>
            <div className="thread">
              {d.messages.map((m) => (
                <div key={m.id} className={`msg${m.staff ? " msg--staff" : ""}`}>
                  {m.body}
                  <small>{m.staff ? "Equipa KIVORA" : d.userName} · {formatDateTime(m.createdAt)}</small>
                </div>
              ))}
            </div>
            {d.status !== "CLOSED" && (
              <label className="field">
                <span className="field__label">Resposta</span>
                <textarea className="input" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
            )}
          </>
        )}
      </DataState>
    </Modal>
  );
}
