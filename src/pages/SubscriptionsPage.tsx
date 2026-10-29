import type { AdminSubscriptionDto } from "@kivora/shared";
import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { DecisionDialog } from "../components/ui/DecisionDialog.js";
import { Modal } from "../components/ui/Modal.js";
import { FilterTabs, PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi, ApiError } from "../lib/api.js";
import { formatDateTime, formatMoney, toMinor } from "../lib/format.js";
import { useAsync } from "../lib/useAsync.js";

const TABS = [
  { value: "PENDING", label: "Por aprovar" },
  { value: "ACTIVE", label: "Activas" },
  { value: "REJECTED", label: "Rejeitadas" },
  { value: "CANCELLED", label: "Canceladas" },
  { value: "", label: "Todas" },
];

export function SubscriptionsPage() {
  const [status, setStatus] = useState("PENDING");
  const [open, setOpen] = useState<AdminSubscriptionDto | null>(null);
  const [yieldFor, setYieldFor] = useState<AdminSubscriptionDto | null>(null);
  const q = useAsync(() => adminApi.subscriptions(status || undefined), [status]);

  return (
    <>
      <PageHeader title="Subscrições e rendimentos" subtitle="Aprove as subscrições aos planos e aplique o rendimento às subscrições activas." />
      <FilterTabs value={status} onChange={setStatus} options={TABS} />
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Sem subscrições neste estado.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Referência</th><th>Cliente</th><th>Plano</th><th className="right">Valor</th><th>Data</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.reference}</td>
                      <td><span className="cell-main">{s.userName}<small>{s.userEmail}</small></span></td>
                      <td>{s.planName}</td>
                      <td className="right nowrap">{formatMoney(s.amountMinor, s.currency)}</td>
                      <td className="nowrap">{formatDateTime(s.createdAt)}</td>
                      <td><Badge status={s.status} /></td>
                      <td className="right">
                        {s.status === "PENDING" && <button className="btn btn--primary btn--sm" type="button" onClick={() => setOpen(s)}>Decidir</button>}
                        {s.status === "ACTIVE" && (
                          <button className="btn btn--accent btn--sm" type="button" onClick={() => setYieldFor(s)}>
                            <TrendingUp size={14} /> Aplicar rendimento
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataState>
      {open && <SubscriptionDecision s={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); q.reload(); }} />}
      {yieldFor && <YieldDialog s={yieldFor} onClose={() => setYieldFor(null)} />}
    </>
  );
}

function SubscriptionDecision({ s, onClose, onDone }: { s: AdminSubscriptionDto; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const money = formatMoney(s.amountMinor, s.currency);
  return (
    <Modal
      title={`Subscrição ${s.reference}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--danger" onClick={() => setAction("reject")} type="button">Rejeitar</button>
          <button className="btn btn--success" onClick={() => setAction("approve")} type="button">Aprovar</button>
        </>
      }
    >
      <dl className="kv">
        <dt>Cliente</dt><dd>{s.userName}<br /><span className="muted">{s.userEmail}</span></dd>
        <dt>Plano</dt><dd>{s.planName}</dd>
        <dt>Valor</dt><dd><strong>{money}</strong></dd>
        <dt>Pedido em</dt><dd>{formatDateTime(s.createdAt)}</dd>
      </dl>
      {action === "approve" && (
        <DecisionDialog title="Aprovar subscrição" tone="success" confirmLabel="Aprovar"
          description={<>A subscrição de <strong>{money}</strong> ao plano <strong>{s.planName}</strong> passa a activa.</>}
          onClose={() => setAction(null)}
          onConfirm={async (n) => { await adminApi.approveSubscription(s.id, n); toast.success("Subscrição aprovada."); onDone(); }} />
      )}
      {action === "reject" && (
        <DecisionDialog title="Rejeitar subscrição" tone="danger" confirmLabel="Rejeitar" noteLabel="Motivo (o cliente é notificado)" noteRequired
          description="O valor reservado volta ao saldo disponível do cliente."
          onClose={() => setAction(null)}
          onConfirm={async (n) => { await adminApi.rejectSubscription(s.id, n); toast.success("Subscrição rejeitada."); onDone(); }} />
      )}
    </Modal>
  );
}

/** Rendimento de uma subscrição: valor fixo em moeda. O servidor faz o lançamento no livro-razão. */
function YieldDialog({ s, onClose }: { s: AdminSubscriptionDto; onClose: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const minor = toMinor(amount, s.currency);
  return (
    <DecisionDialog
      title="Aplicar rendimento"
      tone="success"
      confirmLabel={minor ? `Creditar ${formatMoney(minor, s.currency)}` : "Creditar"}
      noteLabel="Descrição (o cliente vê)"
      description={
        <>
          <p>Cliente: <strong>{s.userName}</strong> — plano <strong>{s.planName}</strong> ({formatMoney(s.amountMinor, s.currency)} investidos).</p>
          <label className="field" style={{ marginTop: 12 }}>
            <span className="field__label">Rendimento a creditar ({s.currency})</span>
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            <span className="field__hint">Entra no saldo disponível do cliente. Não se desfaz.</span>
          </label>
        </>
      }
      onClose={onClose}
      onConfirm={async (note) => {
        if (!minor) throw new ApiError("VALIDATION_ERROR", 400);
        try {
          await adminApi.applyYield(s.id, { amountMinor: minor, note });
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) throw new ApiError("NOT_FOUND", 404);
          throw e;
        }
        toast.success(`Rendimento de ${formatMoney(minor, s.currency)} creditado.`);
      }}
    />
  );
}

