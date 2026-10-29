import type { AdminVerificationDto } from "@kivora/shared";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { BlobViewer } from "../components/ui/BlobViewer.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { DecisionDialog } from "../components/ui/DecisionDialog.js";
import { Modal } from "../components/ui/Modal.js";
import { FilterTabs, PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi } from "../lib/api.js";
import { formatDateTime } from "../lib/format.js";
import { DOC_TYPE_LABEL, FILE_KIND_LABEL } from "../lib/labels.js";
import { useAsync } from "../lib/useAsync.js";

const TABS = [
  { value: "PENDING", label: "Pendentes" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "REJECTED", label: "Rejeitadas" },
  { value: "", label: "Todas" },
];

export function VerificationsPage() {
  const [status, setStatus] = useState("PENDING");
  const [open, setOpen] = useState<AdminVerificationDto | null>(null);
  const q = useAsync(() => adminApi.verifications(status || undefined), [status]);

  return (
    <>
      <PageHeader title="Verificações de identidade" subtitle="Compare o documento com os dados da conta e a selfie." />
      <FilterTabs value={status} onChange={setStatus} options={TABS} />
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Sem verificações neste estado.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Cliente</th><th>Documento</th><th>País</th><th>Enviada em</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id} className="row-click" onClick={() => setOpen(v)}>
                      <td><span className="cell-main">{v.userName}<small>{v.userEmail}</small></span></td>
                      <td>{DOC_TYPE_LABEL[v.docType] ?? v.docType}</td>
                      <td>{v.issuingCountry}</td>
                      <td className="nowrap">{formatDateTime(v.createdAt)}</td>
                      <td><Badge status={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataState>
      {open && <VerificationReview v={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); q.reload(); }} />}
    </>
  );
}

function VerificationReview({ v, onClose, onDone }: { v: AdminVerificationDto; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  return (
    <Modal
      wide
      title={`Verificação de ${v.userName}`}
      onClose={onClose}
      footer={
        v.status === "PENDING" ? (
          <>
            <button className="btn btn--danger" onClick={() => setAction("reject")} type="button"><X size={16} /> Rejeitar</button>
            <button className="btn btn--success" onClick={() => setAction("approve")} type="button"><Check size={16} /> Aprovar verificação</button>
          </>
        ) : (
          <button className="btn btn--ghost" onClick={onClose} type="button">Fechar</button>
        )
      }
    >
      <dl className="kv">
        <dt>Conta</dt><dd>{v.userName} — <span className="muted">{v.userEmail}</span></dd>
        <dt>Documento</dt><dd>{DOC_TYPE_LABEL[v.docType] ?? v.docType} ({v.issuingCountry})</dd>
        <dt>Enviada em</dt><dd>{formatDateTime(v.createdAt)}</dd>
        <dt>Estado</dt><dd><Badge status={v.status} /></dd>
        {v.rejectionReason && (<><dt>Motivo da rejeição</dt><dd>{v.rejectionReason}</dd></>)}
      </dl>
      <div className="blob-grid">
        {v.files.map((kind) => (
          <BlobViewer key={kind} label={FILE_KIND_LABEL[kind] ?? kind} load={() => adminApi.verificationFile(v.id, kind)} deps={[v.id, kind]} />
        ))}
      </div>

      {action === "approve" && (
        <DecisionDialog title="Aprovar verificação" tone="success" confirmLabel="Aprovar" noteHidden
          description={<>Confirma que o documento é válido, legível e pertence a <strong>{v.userName}</strong>, e que a selfie corresponde?</>}
          onClose={() => setAction(null)}
          onConfirm={async () => { await adminApi.approveVerification(v.id); toast.success("Verificação aprovada."); onDone(); }} />
      )}
      {action === "reject" && (
        <DecisionDialog title="Rejeitar verificação" tone="danger" confirmLabel="Rejeitar" noteLabel="Motivo (o cliente vê-o e pode reenviar)" noteRequired
          description="Diga o que corrigir: documento cortado, ilegível, caducado, selfie sem o documento…"
          onClose={() => setAction(null)}
          onConfirm={async (n) => { await adminApi.rejectVerification(v.id, n); toast.success("Verificação rejeitada."); onDone(); }} />
      )}
    </Modal>
  );
}
