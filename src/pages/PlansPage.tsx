import { ImagePlus, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { DecisionDialog } from "../components/ui/DecisionDialog.js";
import { Modal } from "../components/ui/Modal.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi, ApiError, type AdminPlan, type PlanInput } from "../lib/api.js";
import { formatMoney, fromMinor, percentToBp, toMinor } from "../lib/format.js";
import { fileToBase64Image } from "../lib/image.js";
import { errorText } from "../lib/labels.js";
import { useAsync } from "../lib/useAsync.js";

const STATUS_OPTIONS: { value: PlanInput["status"]; label: string }[] = [
  { value: "DRAFT", label: "Rascunho (invisível aos clientes)" },
  { value: "COMING_SOON", label: "Em breve (visível, sem subscrição)" },
  { value: "OPEN", label: "Aberto (clientes podem subscrever)" },
  { value: "CLOSED", label: "Fechado" },
];

export function PlansPage() {
  const q = useAsync(() => adminApi.plans(), []);
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);
  const [yieldPlan, setYieldPlan] = useState<AdminPlan | null>(null);

  return (
    <>
      <PageHeader
        title="Planos"
        subtitle="Crie e edite os planos de investimento: texto, imagem, limites, prazo e estado."
        actions={
          <button className="btn btn--primary" type="button" onClick={() => setEditing("new")}>
            <Plus size={16} /> Novo plano
          </button>
        }
      />
      <DataState q={q}>
        {(plans) =>
          plans.length === 0 ? (
            <Empty>Ainda não há planos. Crie o primeiro.</Empty>
          ) : (
            <div className="plans">
              {plans.map((p) => {
                const fill = p.capacityMinor && p.committedMinor !== null ? Math.min(100, Math.round((p.committedMinor / p.capacityMinor) * 100)) : null;
                return (
                  <article key={p.id} className="plan-card">
                    <div className="plan-card__img">{p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span>{p.name}</span>}</div>
                    <div className="plan-card__body">
                      <div className="plan-card__top">
                        <h2>{p.name}</h2>
                        <Badge status={p.status} />
                      </div>
                      <p className="plan-card__desc">{p.description || "Sem descrição."}</p>
                      <div className="plan-card__meta">
                        <div><small>Mínimo</small>{formatMoney(p.minMinor)}</div>
                        <div><small>Máximo</small>{formatMoney(p.maxMinor)}</div>
                        <div><small>Prazo</small>{p.termDays ? `${p.termDays} dias` : "—"}</div>
                        <div><small>Risco</small>{p.riskLabel || "—"}</div>
                      </div>
                      {fill !== null && (
                        <div>
                          <div className="meter" aria-hidden><span style={{ width: `${fill}%` }} /></div>
                          <small className="muted">{formatMoney(p.committedMinor)} de {formatMoney(p.capacityMinor)} ({fill}%)</small>
                        </div>
                      )}
                      <div className="btn-row" style={{ marginTop: "auto" }}>
                        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditing(p)}><Pencil size={14} /> Editar</button>
                        <button className="btn btn--accent btn--sm" type="button" onClick={() => setYieldPlan(p)}><TrendingUp size={14} /> Rendimento</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        }
      </DataState>
      {editing && <PlanEditor plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); q.reload(); }} />}
      {yieldPlan && <PlanYieldDialog plan={yieldPlan} onClose={() => setYieldPlan(null)} />}
    </>
  );
}

/* ---------- Editor ---------- */

function PlanEditor({ plan, onClose, onSaved }: { plan: AdminPlan | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    min: fromMinor(plan?.minMinor),
    max: fromMinor(plan?.maxMinor),
    capacity: fromMinor(plan?.capacityMinor),
    termDays: plan?.termDays ? String(plan.termDays) : "",
    riskLabel: plan?.riskLabel ?? "",
    status: plan?.status ?? ("DRAFT" as PlanInput["status"]),
    sortOrder: String(plan?.sortOrder ?? 0),
  });
  const [image, setImage] = useState<{ mime: "image/jpeg" | "image/png" | "image/webp"; dataBase64: string; previewUrl: string } | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));

  const preview = image?.previewUrl ?? (removeImage ? null : plan?.imageUrl ?? null);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await fileToBase64Image(file));
      setRemoveImage(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error && e.message === "TOO_BIG" ? "A imagem é demasiado grande. Use uma mais pequena." : "Use uma imagem JPG, PNG ou WebP.");
    }
  }

  /** Campo de dinheiro opcional: vazio = null; inválido = undefined. */
  const money = (t: string): number | null | undefined => (t.trim() === "" ? null : toMinor(t) ?? undefined);

  function build(): PlanInput | string {
    const min = money(f.min), max = money(f.max), cap = money(f.capacity);
    if (f.name.trim().length < 2) return "Indique o nome do plano (mínimo 2 caracteres).";
    if (min === undefined) return "Valor mínimo inválido.";
    if (max === undefined) return "Valor máximo inválido.";
    if (cap === undefined) return "Capacidade inválida.";
    if (min !== null && max !== null && min > max) return "O mínimo não pode ser superior ao máximo.";
    const term = f.termDays.trim() === "" ? null : Number(f.termDays);
    if (term !== null && (!Number.isInteger(term) || term <= 0 || term > 36500)) return "Prazo inválido (dias inteiros).";
    const sort = Number(f.sortOrder);
    if (!Number.isInteger(sort) || sort < -1000 || sort > 1000) return "Ordem inválida (entre -1000 e 1000).";
    return {
      name: f.name.trim(),
      description: f.description.trim(),
      minMinor: min,
      maxMinor: max,
      capacityMinor: cap,
      termDays: term,
      riskLabel: f.riskLabel.trim(),
      status: f.status,
      sortOrder: sort,
    };
  }

  async function save() {
    const input = build();
    if (typeof input === "string") return setError(input);
    setBusy(true);
    setError(null);
    try {
      const saved = plan ? await adminApi.updatePlan(plan.id, input) : await adminApi.createPlan(input);
      let imageNote = "";
      try {
        if (image) await adminApi.uploadPlanImage(saved.id, { mime: image.mime, dataBase64: image.dataBase64 });
        else if (removeImage && plan?.imageUrl) await adminApi.removePlanImage(saved.id);
      } catch (e) {
        imageNote = e instanceof ApiError && e.status === 404
          ? " A imagem não foi guardada: o servidor ainda não tem a rota de imagens (ver docs/BACKEND-PENDENTE.md)."
          : ` A imagem não foi guardada (${errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR")}).`;
      }
      if (imageNote) toast.error(`Plano guardado.${imageNote}`);
      else toast.success("Plano guardado.");
      onSaved();
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={plan ? `Editar plano — ${plan.name}` : "Novo plano"}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn btn--primary" type="button" onClick={() => void save()} disabled={busy}>{busy ? "A guardar…" : "Guardar plano"}</button>
        </>
      }
    >
      <div className="image-edit">
        <div className="image-edit__preview">{preview ? <img src={preview} alt="Imagem do plano" /> : "Sem imagem"}</div>
        <div className="btn-row">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> {preview ? "Trocar imagem" : "Escolher imagem"}</button>
          {preview && <button className="btn btn--ghost btn--sm" type="button" onClick={() => { setImage(null); setRemoveImage(true); }}><Trash2 size={14} /> Remover</button>}
        </div>
        <span className="field__hint">Formato 16:9 recomendado. A imagem é reduzida para 1200 px antes de enviar.</span>
      </div>

      <div className="form-grid">
        <label className="field"><span className="field__label">Nome</span><input className="input" maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="field">
          <span className="field__label">Estado</span>
          <select className="input" value={f.status} onChange={(e) => set("status", e.target.value as PlanInput["status"])}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="field full">
          <span className="field__label">Descrição</span>
          <textarea className="input" rows={5} maxLength={4000} value={f.description} onChange={(e) => set("description", e.target.value)} />
          <span className="field__hint">{f.description.length}/4000 — é o que o cliente lê antes de subscrever.</span>
        </label>
        <label className="field"><span className="field__label">Valor mínimo (Kz)</span><input className="input" inputMode="decimal" value={f.min} onChange={(e) => set("min", e.target.value)} /></label>
        <label className="field"><span className="field__label">Valor máximo (Kz)</span><input className="input" inputMode="decimal" value={f.max} onChange={(e) => set("max", e.target.value)} /></label>
        <label className="field">
          <span className="field__label">Capacidade total (Kz)</span>
          <input className="input" inputMode="decimal" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} />
          <span className="field__hint">Vazio = sem limite de capacidade.</span>
        </label>
        <label className="field"><span className="field__label">Prazo (dias)</span><input className="input" inputMode="numeric" value={f.termDays} onChange={(e) => set("termDays", e.target.value)} /></label>
        <label className="field"><span className="field__label">Etiqueta de risco</span><input className="input" maxLength={80} value={f.riskLabel} onChange={(e) => set("riskLabel", e.target.value)} placeholder="Ex.: Baixo, Moderado, Alto" /></label>
        <label className="field"><span className="field__label">Ordem de apresentação</span><input className="input" inputMode="numeric" value={f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></label>
      </div>
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
    </Modal>
  );
}

/* ---------- Rendimento por plano (percentagem sobre todas as subscrições activas) ---------- */

function PlanYieldDialog({ plan, onClose }: { plan: AdminPlan; onClose: () => void }) {
  const toast = useToast();
  const [pct, setPct] = useState("");
  const subs = useAsync(async () => (await adminApi.subscriptions("ACTIVE")).filter((s) => s.planId === plan.id), [plan.id]);
  const bp = percentToBp(pct);
  const base = subs.data?.reduce((n, s) => n + s.amountMinor, 0) ?? 0;
  const estimate = bp ? Math.round((base * bp) / 10000) : 0;

  if (!subs.data) {
    return (
      <Modal title={`Rendimento — ${plan.name}`} onClose={onClose}>
        {subs.error ? <div className="alert alert--danger" role="alert">{errorText(subs.error.code)}</div> : <div className="state">A carregar subscrições activas…</div>}
      </Modal>
    );
  }
  if (subs.data.length === 0) {
    return (
      <Modal title={`Rendimento — ${plan.name}`} onClose={onClose} footer={<button className="btn btn--ghost" type="button" onClick={onClose}>Fechar</button>}>
        Este plano não tem subscrições activas.
      </Modal>
    );
  }
  return (
    <DecisionDialog
      title={`Rendimento — ${plan.name}`}
      tone="success"
      confirmLabel={bp ? `Aplicar ${pct}% a ${subs.data.length} subscrições` : "Aplicar"}
      noteLabel="Descrição (os clientes vêem)"
      description={
        <>
          <p>
            Aplica a percentagem ao valor investido em <strong>{subs.data.length}</strong> subscrições activas
            (total investido <strong>{formatMoney(base)}</strong>) e credita cada cliente.
          </p>
          <label className="field" style={{ marginTop: 12 }}>
            <span className="field__label">Percentagem do período (%)</span>
            <input className="input" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Ex.: 2,5" />
            {bp !== null && <span className="field__hint">Estimativa: {formatMoney(estimate)} no total. O servidor calcula o valor exacto de cada cliente.</span>}
          </label>
        </>
      }
      onClose={onClose}
      onConfirm={async (note) => {
        if (!bp) throw new ApiError("VALIDATION_ERROR", 400);
        const r = await adminApi.applyPlanYield(plan.id, { percentBp: bp, note });
        toast.success(`Rendimento aplicado a ${r.applied} subscrições (${formatMoney(r.totalMinor)}).`);
      }}
    />
  );
}
