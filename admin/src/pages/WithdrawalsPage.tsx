import type { AdminWithdrawalDto } from "@kivora/shared";
import { useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { DecisionDialog } from "../components/ui/DecisionDialog.js";
import { Modal } from "../components/ui/Modal.js";
import { FilterTabs, PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi } from "../lib/api.js";
import { formatDateTime, formatMoney } from "../lib/format.js";
import { useAsync } from "../lib/useAsync.js";

const TABS = [
  { value: "PENDING", label: "Por aprovar" },
  { value: "APPROVED", label: "Aprovados (por pagar)" },
  { value: "PAID", label: "Pagos" },
  { value: "REJECTED", label: "Rejeitados" },
  { value: "", label: "Todos" },
];

type Action = "approve" | "paid" | "reject";

export function WithdrawalsPage() {
  const [status, setStatus] = useState("PENDING");
  const [open, setOpen] = useState<AdminWithdrawalDto | null>(null);
  const q = useAsync(() => adminApi.withdrawals(status || undefined), [status]);

  return (
    <>
      <PageHeader title="Levantamentos" subtitle="Aprove o pedido, faça a transferência ao cliente e marque como pago." />
      <FilterTabs value={status} onChange={setStatus} options={TABS} />
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Sem levantamentos neste estado.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Referência</th><th>Cliente</th><th>Destino</th><th className="right">Valor</th><th>Data</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {rows.map((w) => (
                    <tr key={w.id} className="row-click" onClick={() => setOpen(w)}>
                      <td className="mono">{w.reference}</td>
                      <td><span className="cell-main">{w.userName}<small>{w.userEmail}</small></span></td>
                      <td>{w.destination}</td>
                      <td className="right nowrap">{formatMoney(w.amountMinor, w.currency)}</td>
                      <td className="nowrap">{formatDateTime(w.createdAt)}</td>
                      <td><Badge status={w.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataState>
      {open && <WithdrawalReview w={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); q.reload(); }} />}
    </>
  );
}

function WithdrawalReview({ w, onClose, onDone }: { w: AdminWithdrawalDto; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [action, setAction] = useState<Action | null>(null);
  const money = formatMoney(w.amountMinor, w.currency);

  const footer =
    w.status === "PENDING" ? (
      <>
        <button className="btn btn--danger" onClick={() => setAction("reject")} type="button">Rejeitar</button>
        <button className="btn btn--success" onClick={() => setAction("approve")} type="button">Aprovar</button>
      </>
    ) : w.status === "APPROVED" ? (
      <>
        <button className="btn btn--danger" onClick={() => setAction("reject")} type="button">Rejeitar</button>
        <button className="btn btn--success" onClick={() => setAction("paid")} type="button">Marcar como pago</button>
      </>
    ) : (
      <button className="btn btn--ghost" onClick={onClose} type="button">Fechar</button>
    );

  return (
    <Modal title={`Levantamento ${w.reference}`} onClose={onClose} footer={footer}>
      <dl className="kv">
        <dt>Cliente</dt><dd>{w.userName}<br /><span className="muted">{w.userEmail}</span></dd>
        <dt>Valor</dt><dd><strong>{money}</strong></dd>
        <dt>Método</dt><dd>{w.methodName}</dd>
        <dt>Destino</dt><dd>{w.destination}</dd>
        <dt>Criado em</dt><dd>{formatDateTime(w.createdAt)}</dd>
        <dt>Estado</dt><dd><Badge status={w.status} /></dd>
        {w.decisionNote && (<><dt>Nota</dt><dd>{w.decisionNote}</dd></>)}
      </dl>

      {action === "approve" && (
        <DecisionDialog title="Aprovar levantamento" tone="success" confirmLabel="Aprovar"
          description={<>Aprove só depois de conferir o saldo e a identidade. Depois, transfira <strong>{money}</strong> para <strong>{w.destination}</strong> e marque como pago.</>}
          onClose={() => setAction(null)}
          onConfirm={async (n) => { await adminApi.approveWithdrawal(w.id, n); toast.success("Levantamento aprovado."); onDone(); }} />
      )}
      {action === "paid" && (
        <DecisionDialog title="Marcar como pago" tone="success" confirmLabel="Confirmar pagamento" noteLabel="Referência da transferência"
          description={<>Confirma que transferiu <strong>{money}</strong> para <strong>{w.destination}</strong>?</>}
          onClose={() => setAction(null)}
          onConfirm={async (n) => { await adminApi.payWithdrawal(w.id, n); toast.success("Levantamento marcado como pago."); onDone(); }} />
      )}
      {action === "reject" && (
        <DecisionDialog title="Rejeitar levantamento" tone="danger" confirmLabel="Rejeitar" noteLabel="Motivo (o cliente é notificado)" noteRequired
          description="O valor reservado volta ao saldo disponível do cliente."
          onClose={() => setAction(null)}
          onConfirm={async (n) => { await adminApi.rejectWithdrawal(w.id, n); toast.success("Levantamento rejeitado."); onDone(); }} />
      )}
    </Modal>
  );
}
