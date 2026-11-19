/*
 * Curva do rendimento diário de um plano de rendimento fixo.
 *
 * O administrador define, por plano, um rendimento fixo por dia (ex.: 250 Kz por dia num plano de 3 000 Kz).
 * Cada dia de 24 h, contado desde o início da subscrição, reparte esse rendimento por 96 passos de 15 minutos com
 * pesos diferentes (uns passos rendem mais, outros quase nada). A soma dos pesos é exactamente 1, por isso:
 *   - ao fim de cada dia o plano gerou EXACTAMENTE o rendimento diário definido;
 *   - ao fim do prazo gerou EXACTAMENTE rendimento diário x dias.
 *
 * A função é pura e determinística (depende só da semente e do instante). O servidor usa-a para calcular o
 * dinheiro gerado e o ecrã usa a MESMA função para desenhar o gráfico, por isso o que se vê é o que se recebe.
 * A semente é o identificador da subscrição; cada dia tem o seu próprio desenho.
 */

export const YIELD_CYCLE_MS = 86_400_000;
export const YIELD_STEPS = 96;

const cache = new Map<string, readonly number[]>();

function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fracção do rendimento do dia já gerada ao fim de cada passo: YIELD_STEPS + 1 valores, de 0 (início do dia)
 * a 1 (fim do dia), sempre a crescer.
 */
export function dayProfile(seed: string, cycle: number): readonly number[] {
  const key = `${seed}:${cycle}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rnd = mulberry32(hash32(key));
  const weights: number[] = [];
  let sum = 0;
  let prev = 0.55;
  for (let i = 0; i < YIELD_STEPS; i++) {
    const raw = 0.08 + rnd() * rnd() * 1.9;
    // Mistura com o passo anterior: dá fases mais rápidas e mais lentas em vez de saltos soltos.
    const w = 0.4 * prev + 0.6 * raw;
    prev = w;
    weights.push(w);
    sum += w;
  }
  const cum: number[] = [0];
  let acc = 0;
  for (let i = 0; i < YIELD_STEPS; i++) {
    acc += (weights[i] ?? 0) / sum;
    cum.push(i === YIELD_STEPS - 1 ? 1 : acc);
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, cum);
  return cum;
}

/** Dias de rendimento acumulados (1 = um dia completo) ao fim de `elapsedMs` desde o início do plano. */
export function yieldDays(seed: string, elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const cycle = Math.floor(elapsedMs / YIELD_CYCLE_MS);
  const pos = ((elapsedMs - cycle * YIELD_CYCLE_MS) / YIELD_CYCLE_MS) * YIELD_STEPS;
  const i = Math.min(YIELD_STEPS - 1, Math.floor(pos));
  const cum = dayProfile(seed, cycle);
  const a = cum[i] ?? 0;
  const b = cum[i + 1] ?? 1;
  return cycle + a + (b - a) * (pos - i);
}
