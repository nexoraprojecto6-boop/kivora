import type { AdminDepositDto } from "@kivora/shared";
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
import { formatDateTime, formatMoney } from "../lib/format.js";
import { useAsync } from "../lib/useAsync.js";

const TABS = [
  { value: "PENDING", label: "Pendentes" },
  { value: "CONFIRMED", label: "Confirmados" },
  { value: "REJECTED", label: "Rejeitados" },
  { value: "", label: "Todos" },
];

export function DepositsPage() {
  const [status, setStatus] = useState("PENDING");
  const [open, setOpen] = useState<AdminDepositDto | null>(null);
  const q = useAsync(() => adminApi.deposits(status || undefined), [status]);

  return (
    <>
      <PageHeader title="Depósitos" subtitle="Analise o comprovativo e confirme ou rejeite. Ao confirmar, o saldo do cliente é creditado." />
      <FilterTabs value={status} onChange={setStatus} options={TABS} />
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Sem depósitos neste estado.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Referência</th><th>Cliente</th><th>Método</th><th className="right">Valor</th><th>Data</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} className="row-click" onClick={() => setOpen(d)}>
                      <td className="mono">{d.reference}</td>
                      <td><span className="cell-main">{d.userName}<small>{d.userEmail}</small></span></td>
                      <td>{d.methodName}</td>
                      <td className="right nowrap">{formatMoney(d.amountMinor, d.currency)}</td>
                      <td className="nowrap">{formatDateTime(d.createdAt)}</td>
                      <td><Badge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataState>
      {open && <DepositReview deposit={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); q.reload(); }} />}
    </>
  );
}

function DepositReview({ deposit: d, onClose, onDone }: { deposit: AdminDepositDto; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [action, setAction] = useState<"confirm" | "reject" | null>(null);
  const pending = d.status === "PENDING";

  return (
    <Modal
      wide
      title={`Depósito ${d.reference}`}
      onClose={onClose}
      footer={
        pending ? (
          <>
            <button className="btn btn--danger" onClick={() => setAction("reject")} type="button"><X size={16} /> Rejeitar</button>
            <button className="btn btn--success" onClick={() => setAction("confirm")} type="button"><Check size={16} /> Confirmar depósito</button>
          </>
        ) : (
          <button className="btn btn--ghost" onClick={onClose} type="button">Fechar</button>
        )
      }
    >
      <div className="split">
        <dl className="kv">
          <dt>Cliente</dt><dd>{d.userName}<br /><span className="muted">{d.userEmail}</span></dd>
          <dt>Valor declarado</dt><dd><strong>{formatMoney(d.amountMinor, d.currency)}</strong></dd>
          <dt>Método</dt><dd>{d.methodName}</dd>
          {d.rail === "CRYPTO" && (
            <>
              <dt>Moeda / rede</dt><dd><strong>{d.payTo.coin}</strong> · {d.payTo.network}</dd>
              <dt>Endereço da KIVORA</dt><dd className="mono" style={{ wordBreak: "break-all" }}>{d.payTo.number}</dd>
              {d.payTo.reference && (<><dt>Memo / tag</dt><dd className="mono">{d.payTo.reference}</dd></>)}
            </>
          )}
          {d.txId && (<><dt>{d.rail === "CRYPTO" ? "Hash da transacção (TxID)" : "ID da transacção"}</dt><dd className="mono" style={{ wordBreak: "break-all" }}>{d.txId}</dd></>)}
          <dt>Criado em</dt><dd>{formatDateTime(d.createdAt)}</dd>
          <dt>Estado</dt><dd><Badge status={d.status} /></dd>
          {d.userNote && (<><dt>Nota do cliente</dt><dd>{d.userNote}</dd></>)}
          {d.decidedAt && (<><dt>Decidido em</dt><dd>{formatDateTime(d.decidedAt)}</dd></>)}
          {d.decisionNote && (<><dt>Nota da decisão</dt><dd>{d.decisionNote}</dd></>)}
        </dl>
        <BlobViewer label="Comprovativo" load={() => adminApi.depositProof(d.id)} deps={[d.id]} emptyText="O cliente ainda não anexou comprovativo." />
      </div>
      <div className="alert alert--info">
        {d.rail === "CRYPTO"
          ? "Confira o hash numa explorer da rede indicada: moeda, rede, endereço de destino e valor recebido. Só confirme quando os fundos estiverem na carteira da KIVORA."
          : "Confira no extracto do banco: valor, data, referência e titular. Só confirme quando o dinheiro estiver na conta da KIVORA."}
      </div>

      {action === "confirm" && (
        <DecisionDialog
          title="Confirmar depósito"
          tone="success"
          confirmLabel={`Creditar ${formatMoney(d.amountMinor, d.currency)}`}
          description={<>O saldo disponível de <strong>{d.userName}</strong> será creditado com <strong>{formatMoney(d.amountMinor, d.currency)}</strong>. Esta acção não se desfaz.</>}
          onClose={() => setAction(null)}
          onConfirm={async (note) => { await adminApi.confirmDeposit(d.id, note); toast.success("Depósito confirmado e saldo creditado."); onDone(); }}
        />
      )}
      {action === "reject" && (
        <DecisionDialog
          title="Rejeitar depósito"
          tone="danger"
          confirmLabel="Rejeitar"
          noteLabel="Motivo (o cliente é notificado)"
          noteRequired
          description="Explique o motivo, por exemplo: comprovativo ilegível, valor diferente, pagamento não encontrado."
          onClose={() => setAction(null)}
          onConfirm={async (note) => { await adminApi.rejectDeposit(d.id, note); toast.success("Depósito rejeitado."); onDone(); }}
        />
      )}
    </Modal>
  );
}
