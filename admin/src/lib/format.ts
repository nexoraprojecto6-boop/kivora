/** Moeda de trabalho do painel. A API devolve a moeda em cada registo; AOA é o valor por omissão. */
export const DEFAULT_CURRENCY = "AOA";

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(currency: string): Intl.NumberFormat {
  let f = nfCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("pt-AO", { style: "currency", currency });
    nfCache.set(currency, f);
  }
  return f;
}

export function minorFactor(currency: string = DEFAULT_CURRENCY): number {
  return 10 ** (nf(currency).resolvedOptions().maximumFractionDigits ?? 2);
}

/** Menor unidade → texto formatado (ex.: 1250000 → "12 500,00 Kz"). */
export function formatMoney(minor: number | null | undefined, currency: string = DEFAULT_CURRENCY): string {
  if (minor === null || minor === undefined) return "—";
  return nf(currency).format(minor / minorFactor(currency));
}

/** Texto digitado (unidades, vírgula ou ponto) → menor unidade. Null se inválido. */
export function toMinor(text: string, currency: string = DEFAULT_CURRENCY): number | null {
  const t = text.replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * minorFactor(currency)) : null;
}

/** Menor unidade → texto para pôr num campo de edição. */
export function fromMinor(minor: number | null | undefined, currency: string = DEFAULT_CURRENCY): string {
  if (minor === null || minor === undefined) return "";
  return String(minor / minorFactor(currency)).replace(".", ",");
}

const dtf = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" });
const df = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" });

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dtf.format(d);
}
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : df.format(d);
}

/** Percentagem digitada (ex.: "2,5") → pontos-base inteiros (250). Null se inválido. */
export function percentToBp(text: string): number | null {
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return null;
  return Math.round(n * 100);
}
