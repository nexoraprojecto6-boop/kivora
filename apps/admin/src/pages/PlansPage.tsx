import { BarChart3, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { DeleteDialog } from "../components/ui/DeleteDialog.js";
import { Modal } from "../components/ui/Modal.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi, ApiError, type AdminPlan, type PlanInput } from "../lib/api.js";
import { formatMoney, fromMinor, toMinor } from "../lib/format.js";
import { fileToBase64Image } from "../lib/image.js";
import { errorText } from "../lib/labels.js";
import { useAsync } from "../lib/useAsync.js";

const STATUS_OPTIONS: { value: PlanInput["status"]; label: string }[] = [
  { value: "DRAFT", label: "Rascunho (invisível aos clientes)" },
  { value: "COMING_SOON", label: "Em breve (visível, sem subscrição)" },
  { value: "OPEN", label: "Aberto (clientes podem subscrever)" },
  { value: "CLOSED", label: "Fechado" },
];

/** Percentagem diária = rendimento / preço (ex.: 250 / 3000 = 8,33 %). */
const dailyPct = (price: number | null, yieldMinor: number | null): string =>
  price && yieldMinor ? `${((yieldMinor / price) * 100).toFixed(2).replace(".", ",")} %` : "—";

export function PlansPage() {
  const q = useAsync(() => adminApi.plans(), []);
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminPlan | null>(null);
  const toast = useToast();
  const [statsPlan, setStatsPlan] = useState<AdminPlan | null>(null);

  return (
    <>
      <PageHeader
        title="Planos"
        subtitle="Cada plano tem foto, nome, preço, rendimento por dia, prazo e condições. Tudo o que o cliente vê vem daqui."
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
                      <div className="plan-card__meta">
                        <div><small>Preço</small>{formatMoney(p.minMinor)}</div>
                        <div><small>Rendimento por dia</small>{p.dailyYieldMinor ? `${formatMoney(p.dailyYieldMinor)} (${dailyPct(p.minMinor, p.dailyYieldMinor)})` : "— (configurar)"}</div>
                        <div><small>Prazo</small>{p.termDays ? `${p.termDays} dias` : "—"}</div>
                        <div><small>Mercado</small>{p.marketLabel || "—"}</div>
                        <div><small>Levantamento</small>{p.payoutIntervalDays === 1 ? "Diário" : `De ${p.payoutIntervalDays} em ${p.payoutIntervalDays} dias`}</div>
                      </div>
                      {fill !== null && (
                        <div>
                          <div className="meter" aria-hidden><span style={{ width: `${fill}%` }} /></div>
                          <small className="muted">{formatMoney(p.committedMinor)} de {formatMoney(p.capacityMinor)} ({fill}%)</small>
                        </div>
                      )}
                      <div className="btn-row" style={{ marginTop: "auto" }}>
                        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditing(p)}><Pencil size={14} /> Editar</button>
                        <button className="btn btn--accent btn--sm" type="button" onClick={() => setStatsPlan(p)}><BarChart3 size={14} /> Estatísticas</button>
                        <button className="btn btn--ghost btn--sm" type="button" aria-label={`Apagar ${p.name}`} onClick={() => setDeleting(p)}><Trash2 size={14} /> Apagar</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        }
      </DataState>
      {deleting && (
        <DeleteDialog
          title="Apagar plano"
          name={deleting.name}
          inUseText="Este plano já tem subscrições de clientes, por isso não pode ser apagado (o dinheiro e o histórico dos clientes dependem dele). Edite-o e ponha o estado em «Fechado» ou «Rascunho» para deixar de aparecer."
          onConfirm={async () => { await adminApi.deletePlan(deleting.id); toast.success("Plano apagado."); q.reload(); }}
          onClose={() => setDeleting(null)}
        />
      )}
      {editing && <PlanEditor plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); q.reload(); }} />}
      {statsPlan && <PlanStatsDialog plan={statsPlan} onClose={() => setStatsPlan(null)} />}
    </>
  );
}

/* ---------- Editor ---------- */

function PlanEditor({ plan, onClose, onSaved }: { plan: AdminPlan | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    name: plan?.name ?? "",
    status: plan?.status ?? ("DRAFT" as PlanInput["status"]),
    price: fromMinor(plan?.minMinor),
    dailyYield: fromMinor(plan?.dailyYieldMinor),
    termDays: plan?.termDays ? String(plan.termDays) : "",
    marketLabel: plan?.marketLabel ?? "",
    conditions: plan?.conditions || plan?.description || "",
    payoutDays: String(plan?.payoutIntervalDays ?? 1),
    capacity: fromMinor(plan?.capacityMinor),
    sortOrder: String(plan?.sortOrder ?? 0),
    autoActivate: plan?.autoActivate ?? true,
  });
  const [image, setImage] = useState<{ mime: "image/jpeg" | "image/png" | "image/webp"; dataBase64: string; previewUrl: string } | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));

  const preview = image?.previewUrl ?? (removeImage ? null : plan?.imageUrl ?? null);
  const priceNow = f.price.trim() === "" ? null : toMinor(f.price);
  const yieldNow = f.dailyYield.trim() === "" ? null : toMinor(f.dailyYield);
  const daysNow = Number(f.termDays);
  const totalNow = yieldNow !== null && Number.isInteger(daysNow) && daysNow > 0 ? yieldNow * daysNow : null;

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

  function build(): PlanInput | string {
    if (f.name.trim().length < 2) return "Indique o nome do plano (mínimo 2 caracteres).";
    const price = f.price.trim() === "" ? null : toMinor(f.price);
    const yieldMinor = f.dailyYield.trim() === "" ? null : toMinor(f.dailyYield);
    const cap = f.capacity.trim() === "" ? null : toMinor(f.capacity);
    if (f.price.trim() !== "" && price === null) return "Preço inválido.";
    if (f.dailyYield.trim() !== "" && yieldMinor === null) return "Rendimento por dia inválido.";
    if (f.capacity.trim() !== "" && cap === null) return "Capacidade inválida.";
    const term = f.termDays.trim() === "" ? null : Number(f.termDays);
    if (term !== null && (!Number.isInteger(term) || term <= 0 || term > 36500)) return "Prazo inválido (dias inteiros).";
    const sort = Number(f.sortOrder);
    if (!Number.isInteger(sort) || sort < -1000 || sort > 1000) return "Ordem inválida (entre -1000 e 1000).";
    const days = Number(f.payoutDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) return "Intervalo de levantamento inválido (1 a 90 dias).";
    if (f.status === "OPEN") {
      if (price === null) return "Para abrir o plano à venda indique o preço.";
      if (yieldMinor === null) return "Para abrir o plano à venda indique o rendimento por dia.";
      if (term === null) return "Para abrir o plano à venda indique o prazo em dias.";
    }
    return {
      name: f.name.trim(),
      description: plan?.description ?? "",
      minMinor: price,
      maxMinor: price,
      capacityMinor: cap,
      termDays: term,
      riskLabel: plan?.riskLabel ?? "",
      status: f.status,
      sortOrder: sort,
      howItWorks: plan?.howItWorks ?? "",
      riskDetails: plan?.riskDetails ?? "",
      // Plano simples: sem taxas, sem mercado real e sem bónus; o rendimento é o valor fixo por dia.
      rateMode: "FIXED",
      marketSymbol: null,
      marketLabel: f.marketLabel.trim(),
      baseRateBps: 0,
      minRateBps: 0,
      maxRateBps: 0,
      sensitivityBpsPerPct: 0,
      payoutIntervalDays: days,
      inviteBoostX100: 100,
      autoActivate: f.autoActivate,
      dailyYieldMinor: yieldMinor,
      conditions: f.conditions.trim(),
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
        imageNote = ` A imagem não foi guardada (${errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR")}).`;
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
        <span className="field__hint">Foto do plano (16:9 recomendado). Aparece na lista, no detalhe e no painel do cliente.</span>
      </div>

      <div className="form-grid">
        <label className="field"><span className="field__label">Nome do plano</span><input className="input" maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Plano Bitcoin" /></label>
        <label className="field">
          <span className="field__label">Estado</span>
          <select className="input" value={f.status} onChange={(e) => set("status", e.target.value as PlanInput["status"])}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="field"><span className="field__label">Preço (Kz)</span><input className="input" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="3000" /><span className="field__hint">Valor fixo da compra. O cliente não escolhe o valor.</span></label>
        <label className="field">
          <span className="field__label">Rendimento por dia (Kz)</span>
          <input className="input" inputMode="decimal" value={f.dailyYield} onChange={(e) => set("dailyYield", e.target.value)} placeholder="250" />
          <span className="field__hint">Percentagem do dia: <b>{dailyPct(priceNow, yieldNow)}</b>. No fim de cada dia o plano gerou exactamente este valor.</span>
        </label>
        <label className="field">
          <span className="field__label">Prazo (dias)</span>
          <input className="input" inputMode="numeric" value={f.termDays} onChange={(e) => set("termDays", e.target.value)} placeholder="30" />
          <span className="field__hint">{totalNow !== null ? `Rendimento total até ao fim do prazo: ${formatMoney(totalNow)}.` : "Duração do plano. No fim, o valor do plano volta à carteira."}</span>
        </label>
        <label className="field"><span className="field__label">Mercado (nome que o cliente vê)</span><input className="input" maxLength={60} value={f.marketLabel} onChange={(e) => set("marketLabel", e.target.value)} placeholder="Ex.: Bitcoin" /></label>
        <label className="field full">
          <span className="field__label">Condições</span>
          <textarea className="input" rows={6} maxLength={4000} value={f.conditions} onChange={(e) => set("conditions", e.target.value)} />
          <span className="field__hint">{f.conditions.length}/4000 — é o que o cliente lê ao abrir o plano, antes de comprar.</span>
        </label>
        <label className="field">
          <span className="field__label">Enviar o rendimento para a carteira de quantos em quantos dias</span>
          <input className="input" inputMode="numeric" value={f.payoutDays} onChange={(e) => set("payoutDays", e.target.value)} />
          <span className="field__hint">1 = todos os dias, 3 = de 3 em 3 dias, 7 = semanal.</span>
        </label>
        <label className="field">
          <span className="field__label">Capacidade total (Kz, opcional)</span>
          <input className="input" inputMode="decimal" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} />
          <span className="field__hint">Vazio = sem limite de vendas.</span>
        </label>
        <label className="field"><span className="field__label">Ordem de apresentação</span><input className="input" inputMode="numeric" value={f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></label>
        <label className="field full" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={f.autoActivate} onChange={(e) => set("autoActivate", e.target.checked)} />
          <span>Activar logo ao comprar, sem aprovação manual (o prazo e o rendimento começam a contar na hora)</span>
        </label>
      </div>
      <p className="field__hint" style={{ marginTop: 10 }}>Regras para o cliente: só pode ter 1 plano activo de cada vez e não pode comprar o mesmo plano duas vezes.</p>
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
    </Modal>
  );
}

/* ---------- Estatísticas do plano (calculadas no servidor) ---------- */

function PlanStatsDialog({ plan, onClose }: { plan: AdminPlan; onClose: () => void }) {
  const q = useAsync(() => adminApi.planStats(plan.id), [plan.id]);
  return (
    <Modal title={`Estatísticas — ${plan.name}`} onClose={onClose} footer={<button className="btn btn--ghost" type="button" onClick={onClose}>Fechar</button>}>
      {q.error ? (
        <div className="alert alert--danger" role="alert">{errorText(q.error.code)}</div>
      ) : !q.data ? (
        <div className="state">A carregar…</div>
      ) : (
        <div className="plan-card__meta">
          <div><small>Subscrições activas</small>{q.data.activeSubscriptions}</div>
          <div><small>Capital activo</small>{formatMoney(q.data.principalMinor)}</div>
          <div><small>Rendimento por levantar (aprox.)</small>{formatMoney(q.data.unclaimedMinor)}</div>
          <div><small>Já enviado às carteiras</small>{formatMoney(q.data.claimedMinor)}</div>
        </div>
      )}
    </Modal>
  );
}
