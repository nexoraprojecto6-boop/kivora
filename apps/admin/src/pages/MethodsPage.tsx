import type { PaymentMethodDto } from "@kivora/shared";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { Modal } from "../components/ui/Modal.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi, ApiError, type MethodInput } from "../lib/api.js";
import { formatMoney, fromMinor, toMinor } from "../lib/format.js";
import { errorText } from "../lib/labels.js";
import { useAsync } from "../lib/useAsync.js";

const RAIL_LABEL: Record<string, string> = { PAYPAY: "PayPay AO", KWIK: "Kwik", EXPRESS: "Multicaixa Express", REFERENCIA: "Referência Multicaixa" };

export function MethodsPage() {
  const q = useAsync(() => adminApi.methods(), []);
  const [editing, setEditing] = useState<PaymentMethodDto | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Métodos de pagamento"
        subtitle="Contas e instruções que o cliente vê ao depositar ou levantar (ex.: IBAN, Multicaixa Express)."
        actions={<button className="btn btn--primary" type="button" onClick={() => setEditing("new")}><Plus size={16} /> Novo método</button>}
      />
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Ainda não há métodos. Crie pelo menos um de depósito para os clientes poderem depositar.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Nome</th><th>Tipo</th><th>Serviço</th><th className="right">Mínimo</th><th className="right">Máximo</th><th className="right">Taxa</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td><span className="cell-main">{m.name}<small>{m.instructions.slice(0, 70)}{m.instructions.length > 70 ? "…" : ""}</small></span></td>
                      <td>{m.kind === "DEPOSIT" ? "Depósito" : "Levantamento"}</td>
                      <td>{m.rail ? RAIL_LABEL[m.rail] : "—"}</td>
                      <td className="right nowrap">{formatMoney(m.minMinor)}</td>
                      <td className="right nowrap">{formatMoney(m.maxMinor)}</td>
                      <td className="right nowrap">{formatMoney(m.feeMinor)}</td>
                      <td><Badge text={m.enabled ? "Activo" : "Desactivado"} tone={m.enabled ? "success" : "neutral"} /></td>
                      <td className="right"><button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditing(m)}><Pencil size={14} /> Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataState>
      {editing && <MethodEditor method={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); q.reload(); }} />}
    </>
  );
}

function MethodEditor({ method, onClose, onSaved }: { method: PaymentMethodDto | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const currentFee = method?.feeMinor;
  const [f, setF] = useState({
    kind: method?.kind ?? ("DEPOSIT" as MethodInput["kind"]),
    name: method?.name ?? "",
    instructions: method?.instructions ?? "",
    min: fromMinor(method?.minMinor),
    max: fromMinor(method?.maxMinor),
    fee: currentFee === null || currentFee === undefined ? "" : fromMinor(currentFee) || "0",
    feeNote: method?.feeNote ?? "",
    enabled: method?.enabled ?? true,
    sortOrder: String(method?.sortOrder ?? 0),
    rail: (method?.rail ?? "") as "" | NonNullable<PaymentMethodDto["rail"]>,
    accountHolder: method?.accountHolder ?? "",
    accountNumber: method?.accountNumber ?? "",
    entity: method?.entity ?? "",
    reference: method?.reference ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));
  const money = (t: string): number | null | undefined => (t.trim() === "" ? null : toMinor(t) ?? undefined);

  async function save() {
    const min = money(f.min), max = money(f.max);
    const feeText = f.fee.trim().replace(",", ".");
    const fee = feeText === "" ? null : Number(feeText) === 0 ? 0 : money(f.fee);
    const sort = Number(f.sortOrder);
    if (f.name.trim().length < 2) return setError("Indique o nome (mínimo 2 caracteres).");
    if (min === undefined || max === undefined || fee === undefined) return setError("Há um valor inválido (mínimo, máximo ou taxa).");
    if (min !== null && max !== null && min > max) return setError("O mínimo não pode ser superior ao máximo.");
    if (!Number.isInteger(sort) || sort < -1000 || sort > 1000) return setError("Ordem inválida (entre -1000 e 1000).");
    const isDeposit = f.kind === "DEPOSIT";
    const rail = isDeposit && f.rail !== "" ? f.rail : null;
    if (isDeposit && rail === "REFERENCIA" && (f.entity.trim() === "" || f.reference.trim() === "")) return setError("Indique a entidade e a referência.");
    if (isDeposit && (rail === "PAYPAY" || rail === "KWIK" || rail === "EXPRESS") && f.accountNumber.trim() === "") return setError("Indique o número ou o IBAN da conta.");
    const input: MethodInput = {
      kind: f.kind, name: f.name.trim(), instructions: f.instructions.trim(), minMinor: min, maxMinor: max,
      feeMinor: fee, feeNote: f.feeNote.trim(), enabled: f.enabled, sortOrder: sort,
      rail,
      accountHolder: rail ? f.accountHolder.trim() : "",
      accountNumber: rail && rail !== "REFERENCIA" ? f.accountNumber.trim() : "",
      entity: rail === "REFERENCIA" ? f.entity.trim() : "",
      reference: rail === "REFERENCIA" ? f.reference.trim() : "",
    };
    setBusy(true);
    setError(null);
    try {
      if (method) await adminApi.updateMethod(method.id, input);
      else await adminApi.createMethod(input);
      toast.success("Método guardado.");
      onSaved();
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={method ? `Editar — ${method.name}` : "Novo método de pagamento"}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn btn--primary" type="button" onClick={() => void save()} disabled={busy}>{busy ? "A guardar…" : "Guardar"}</button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Tipo</span>
          <select className="input" value={f.kind} onChange={(e) => set("kind", e.target.value as MethodInput["kind"])}>
            <option value="DEPOSIT">Depósito (cliente paga à KIVORA)</option>
            <option value="WITHDRAWAL">Levantamento (KIVORA paga ao cliente)</option>
          </select>
        </label>
        {f.kind === "DEPOSIT" && (
          <>
            <label className="field full">
              <span className="field__label">Serviço (o cliente escolhe um destes ao depositar)</span>
              <select className="input" value={f.rail} onChange={(e) => set("rail", e.target.value as typeof f.rail)}>
                <option value="">Sem serviço (método antigo)</option>
                <option value="PAYPAY">PayPay AO</option>
                <option value="KWIK">Kwik</option>
                <option value="EXPRESS">Multicaixa Express</option>
                <option value="REFERENCIA">Referência Multicaixa</option>
              </select>
            </label>
            {(f.rail === "PAYPAY" || f.rail === "KWIK" || f.rail === "EXPRESS") && (
              <>
                <label className="field">
                  <span className="field__label">{f.rail === "KWIK" ? "IBAN da plataforma" : f.rail === "PAYPAY" ? "Número PayPay (telefone)" : "Número Express"}</span>
                  <input className="input" maxLength={60} value={f.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
                </label>
                <label className="field">
                  <span className="field__label">Nome do titular</span>
                  <input className="input" maxLength={120} value={f.accountHolder} onChange={(e) => set("accountHolder", e.target.value)} />
                </label>
              </>
            )}
            {f.rail === "REFERENCIA" && (
              <>
                <label className="field"><span className="field__label">Entidade</span><input className="input" maxLength={20} inputMode="numeric" value={f.entity} onChange={(e) => set("entity", e.target.value)} /></label>
                <label className="field"><span className="field__label">Referência</span><input className="input" maxLength={40} value={f.reference} onChange={(e) => set("reference", e.target.value)} /></label>
                <label className="field full"><span className="field__label">Titular / descrição (opcional)</span><input className="input" maxLength={120} value={f.accountHolder} onChange={(e) => set("accountHolder", e.target.value)} /></label>
              </>
            )}
          </>
        )}
        <label className="field"><span className="field__label">Nome</span><input className="input" maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Transferência BAI" /></label>
        <label className="field full">
          <span className="field__label">Instruções para o cliente</span>
          <textarea className="input" rows={5} maxLength={2000} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="IBAN, titular, referência a indicar, prazo…" />
        </label>
        <label className="field"><span className="field__label">Valor mínimo (Kz)</span><input className="input" inputMode="decimal" value={f.min} onChange={(e) => set("min", e.target.value)} /></label>
        <label className="field"><span className="field__label">Valor máximo (Kz)</span><input className="input" inputMode="decimal" value={f.max} onChange={(e) => set("max", e.target.value)} /></label>
        <label className="field"><span className="field__label">Taxa (Kz)</span><input className="input" inputMode="decimal" value={f.fee} onChange={(e) => set("fee", e.target.value)} /><span className="field__hint">Vazio = sem taxa definida.</span></label>
        <label className="field"><span className="field__label">Nota sobre a taxa</span><input className="input" maxLength={300} value={f.feeNote} onChange={(e) => set("feeNote", e.target.value)} /></label>
        <label className="field"><span className="field__label">Ordem de apresentação</span><input className="input" inputMode="numeric" value={f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></label>
        <label className="switch" style={{ alignSelf: "end", minHeight: "2.5rem" }}>
          <input type="checkbox" checked={f.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Método activo (visível aos clientes)
        </label>
      </div>
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
    </Modal>
  );
}
