import { BarChart3, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
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

/** Pontos base por dia (100 = 1 %) <-> texto em % (ex.: 150 <-> "1,5"). */
const bpsToPct = (bps: number): string => String(bps / 100).replace(".", ",");
function pctToBps(text: string): number | null | undefined {
  const t = text.replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : undefined;
}

const MARKET_PRESETS: { symbol: string; label: string }[] = [
  { symbol: "EURUSD=X", label: "Euro / Dólar" },
  { symbol: "GBPUSD=X", label: "Libra / Dólar" },
  { symbol: "USDJPY=X", label: "Dólar / Iene" },
  { symbol: "USDAOA=X", label: "Dólar / Kwanza" },
  { symbol: "^GSPC", label: "S&P 500 (EUA)" },
  { symbol: "^DJI", label: "Dow Jones (EUA)" },
  { symbol: "^IXIC", label: "Nasdaq (EUA)" },
  { symbol: "AAPL", label: "Apple (EUA)" },
  { symbol: "MSFT", label: "Microsoft (EUA)" },
  { symbol: "TSLA", label: "Tesla (EUA)" },
  { symbol: "NVDA", label: "Nvidia (EUA)" },
  { symbol: "BTC-USD", label: "Bitcoin / Dólar" },
  { symbol: "GC=F", label: "Ouro" },
  { symbol: "CL=F", label: "Petróleo (WTI)" },
];

export function PlansPage() {
  const q = useAsync(() => adminApi.plans(), []);
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);
  const [statsPlan, setStatsPlan] = useState<AdminPlan | null>(null);

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
                        <div><small>Taxa de agora</small>{p.currentRateBps === null ? "—" : `${bpsToPct(p.currentRateBps)}%/dia`}</div>
                        <div><small>Mercado</small>{p.rateMode === "MARKET" ? p.marketLabel || p.marketSymbol || "—" : "Taxa fixa"}</div>
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
    description: plan?.description ?? "",
    min: fromMinor(plan?.minMinor),
    max: fromMinor(plan?.maxMinor),
    capacity: fromMinor(plan?.capacityMinor),
    termDays: plan?.termDays ? String(plan.termDays) : "",
    riskLabel: plan?.riskLabel ?? "",
    status: plan?.status ?? ("DRAFT" as PlanInput["status"]),
    sortOrder: String(plan?.sortOrder ?? 0),
    howItWorks: plan?.howItWorks ?? "",
    riskDetails: plan?.riskDetails ?? "",
    rateMode: plan?.rateMode ?? ("FIXED" as PlanInput["rateMode"]),
    marketSymbol: plan?.marketSymbol ?? "",
    marketLabel: plan?.marketLabel ?? "",
    baseRate: bpsToPct(plan?.baseRateBps ?? 0),
    minRate: bpsToPct(plan?.minRateBps ?? 0),
    maxRate: bpsToPct(plan?.maxRateBps ?? 0),
    sensitivity: bpsToPct(plan?.sensitivityBpsPerPct ?? 0),
    payoutDays: String(plan?.payoutIntervalDays ?? 1),
    boost: String((plan?.inviteBoostX100 ?? 200) / 100).replace(".", ","),
    autoActivate: plan?.autoActivate ?? false,
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
    const base = pctToBps(f.baseRate) ?? 0, minR = pctToBps(f.minRate) ?? 0, maxR = pctToBps(f.maxRate) ?? 0, sens = pctToBps(f.sensitivity) ?? 0;
    if ([f.baseRate, f.minRate, f.maxRate, f.sensitivity].some((t) => pctToBps(t) === undefined)) return "Percentagem inválida (use números entre 0 e 100).";
    if (f.rateMode === "FIXED") {
      // Taxa fixa: mínimo e limite acompanham a taxa normal.
    } else {
      if (minR > base || base > maxR) return "A percentagem mínima tem de ser ≤ normal ≤ limite.";
      if (f.marketSymbol.trim() === "") return "Indique o símbolo do mercado (ex.: EURUSD=X, AAPL, ^GSPC).";
      if (!/^[A-Za-z0-9.=^_-]{1,24}$/.test(f.marketSymbol.trim())) return "Símbolo de mercado inválido.";
    }
    const days = Number(f.payoutDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) return "Intervalo de levantamento inválido (1 a 90 dias).";
    const boostN = Number(f.boost.replace(",", "."));
    if (!Number.isFinite(boostN) || boostN < 1 || boostN > 10) return "Bónus de convite inválido (1 = sem bónus, 2 = dobra).";
    return {
      howItWorks: f.howItWorks.trim(),
      riskDetails: f.riskDetails.trim(),
      rateMode: f.rateMode,
      marketSymbol: f.marketSymbol.trim() === "" ? null : f.marketSymbol.trim(),
      marketLabel: f.marketLabel.trim(),
      baseRateBps: base,
      minRateBps: f.rateMode === "FIXED" ? base : minR,
      maxRateBps: f.rateMode === "FIXED" ? base : maxR,
      sensitivityBpsPerPct: f.rateMode === "FIXED" ? 0 : sens,
      payoutIntervalDays: days,
      inviteBoostX100: Math.round(boostN * 100),
      autoActivate: f.autoActivate,
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

      <h3 style={{ margin: "18px 0 8px" }}>Como funciona e riscos (o cliente lê)</h3>
      <div className="form-grid">
        <label className="field full">
          <span className="field__label">Como funciona</span>
          <textarea className="input" rows={4} maxLength={6000} value={f.howItWorks} onChange={(e) => set("howItWorks", e.target.value)} />
        </label>
        <label className="field full">
          <span className="field__label">Detalhe dos riscos</span>
          <textarea className="input" rows={3} maxLength={4000} value={f.riskDetails} onChange={(e) => set("riskDetails", e.target.value)} />
        </label>
      </div>

      <h3 style={{ margin: "18px 0 8px" }}>Percentagem diária e mercado</h3>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Tipo de percentagem</span>
          <select className="input" value={f.rateMode} onChange={(e) => set("rateMode", e.target.value as PlanInput["rateMode"])}>
            <option value="FIXED">Fixa (sempre a normal)</option>
            <option value="MARKET">Segue o mercado (sobe e desce)</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Percentagem normal (% ao dia)</span>
          <input className="input" inputMode="decimal" value={f.baseRate} onChange={(e) => set("baseRate", e.target.value)} />
          <span className="field__hint">Aplica-se quando o mercado está estável ou sem dados.</span>
        </label>
        {f.rateMode === "MARKET" && (
          <>
            <label className="field">
              <span className="field__label">Mínima, mercado em queda (% ao dia)</span>
              <input className="input" inputMode="decimal" value={f.minRate} onChange={(e) => set("minRate", e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Limite, mercado em alta (% ao dia)</span>
              <input className="input" inputMode="decimal" value={f.maxRate} onChange={(e) => set("maxRate", e.target.value)} />
              <span className="field__hint">A percentagem nunca passa deste valor.</span>
            </label>
            <label className="field">
              <span className="field__label">Sensibilidade (% ao dia por cada 1 % do mercado)</span>
              <input className="input" inputMode="decimal" value={f.sensitivity} onChange={(e) => set("sensitivity", e.target.value)} />
              <span className="field__hint">Ex.: normal 1 %, sensibilidade 0,5: se o mercado sobe 2 % hoje, a percentagem passa a 2 % ao dia (até ao limite).</span>
            </label>
            <label className="field">
              <span className="field__label">Símbolo do mercado</span>
              <input className="input" list="market-presets" maxLength={24} value={f.marketSymbol} onChange={(e) => { set("marketSymbol", e.target.value); const hit = MARKET_PRESETS.find((m) => m.symbol === e.target.value); if (hit && f.marketLabel.trim() === "") set("marketLabel", hit.label); }} placeholder="EURUSD=X, AAPL, ^GSPC…" />
              <datalist id="market-presets">{MARKET_PRESETS.map((m) => <option key={m.symbol} value={m.symbol}>{m.label}</option>)}</datalist>
              <span className="field__hint">Símbolos do Yahoo Finance: câmbios, acções dos EUA, índices, cripto e matérias-primas.</span>
            </label>
            <label className="field">
              <span className="field__label">Nome do mercado (o cliente vê)</span>
              <input className="input" maxLength={60} value={f.marketLabel} onChange={(e) => set("marketLabel", e.target.value)} />
            </label>
          </>
        )}
      </div>

      <h3 style={{ margin: "18px 0 8px" }}>Levantamento, convites e activação</h3>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Levantar a comissão de quantos em quantos dias</span>
          <input className="input" inputMode="numeric" value={f.payoutDays} onChange={(e) => set("payoutDays", e.target.value)} />
          <span className="field__hint">1 = diário, 3 = de 3 em 3 dias, 7 = semanal. O dinheiro vai para o saldo da carteira.</span>
        </label>
        <label className="field">
          <span className="field__label">Bónus de convite (multiplicador)</span>
          <input className="input" inputMode="decimal" value={f.boost} onChange={(e) => set("boost", e.target.value)} />
          <span className="field__hint">2 = dobra a percentagem quando um convidado do cliente assina um plano. 1 = sem bónus.</span>
        </label>
        <label className="field full" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={f.autoActivate} onChange={(e) => set("autoActivate", e.target.checked)} />
          <span>Activar logo, sem aprovação manual (o prazo e a comissão começam a contar ao investir)</span>
        </label>
      </div>
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
          <div><small>Comissão por levantar (aprox.)</small>{formatMoney(q.data.unclaimedMinor)}</div>
          <div><small>Já enviado às carteiras</small>{formatMoney(q.data.claimedMinor)}</div>
          <div><small>Taxa de agora</small>{q.data.currentRateBps === null ? "—" : `${bpsToPct(q.data.currentRateBps)} % ao dia`}</div>
          <div><small>Variação do mercado</small>{q.data.currentChangePct === null ? "—" : `${q.data.currentChangePct.toFixed(2)} %`}</div>
          <div><small>Dados do mercado</small>{plan.rateMode === "FIXED" ? "Não usa mercado" : q.data.marketStale ? "Sem dados recentes (taxa normal)" : "Em tempo real"}</div>
        </div>
      )}
    </Modal>
  );
}
