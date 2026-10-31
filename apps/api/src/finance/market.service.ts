import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { MarketPointDto, PlanMarketDto } from "@kivora/shared";
import type { Pool } from "pg";
import { PG_POOL } from "./finance.config.js";
import { evaluatePlanRate, latestTick, staleSeconds } from "./plan-accrual.js";
import { sql } from "./sql.js";

export interface Quote {
  price: number;
  prevClose: number | null;
}

/**
 * Cotação do Yahoo Finance (endpoint público, sem chave). Serve câmbios (EURUSD=X), acções dos EUA (AAPL),
 * índices (^GSPC), criptomoedas (BTC-USD) e matérias-primas. NÃO é uma API oficial: pode mudar ou bloquear.
 * Para produção séria, trocar por um fornecedor pago implementando esta mesma função (ver MarketService.fetchQuote).
 */
export async function fetchYahooQuote(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KivoraMarketFeed/1.0)", Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = (await res.json()) as { chart?: { result?: { meta?: Record<string, unknown> }[] | null } };
  const meta = json.chart?.result?.[0]?.meta;
  if (!meta) throw new Error("Yahoo sem dados para o símbolo");
  const price = meta["regularMarketPrice"];
  const prev = meta["chartPreviousClose"] ?? meta["previousClose"];
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) throw new Error("Yahoo: preço inválido");
  return { price, prevClose: typeof prev === "number" && Number.isFinite(prev) && prev > 0 ? prev : null };
}

const SNAPSHOT_POINTS = 180;

/**
 * Mercado em tempo real, no servidor:
 *  - de N em N segundos (MARKET_POLL_SECONDS, 20 por omissão) pede a cotação de cada símbolo usado por planos;
 *  - guarda os pontos (market_ticks) para o gráfico e recalcula a taxa de cada plano;
 *  - os clientes só leem o que está guardado: nunca falam com o fornecedor nem escolhem preços.
 */
@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MarketService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastWarnAt = 0;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  onModuleInit(): void {
    if (process.env["MARKET_POLL_ENABLED"] === "false") return;
    const n = Number(process.env["MARKET_POLL_SECONDS"] ?? "20");
    const seconds = Number.isInteger(n) ? Math.min(600, Math.max(10, n)) : 20;
    this.timer = setInterval(() => void this.poll(), seconds * 1000);
    this.timer.unref();
    setTimeout(() => void this.poll(), 3_000).unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Um fornecedor por plano. Hoje só existe YAHOO. */
  protected fetchQuote(provider: string, symbol: string): Promise<Quote> {
    if (provider === "YAHOO") return fetchYahooQuote(symbol);
    return Promise.reject(new Error(`Fornecedor desconhecido: ${provider}`));
  }

  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const plans = await sql<{ id: string; provider: string; symbol: string | null; mode: string }>(
        this.pool,
        `SELECT p.id, p.market_provider AS provider, p.market_symbol AS symbol, p.rate_mode AS mode
           FROM plans p
          WHERE p.status <> 'DRAFT' OR EXISTS (SELECT 1 FROM plan_subscriptions s WHERE s.plan_id = p.id AND s.status = 'ACTIVE')`,
      );
      const symbols = new Map<string, { provider: string; symbol: string }>();
      for (const p of plans) if (p.mode === "MARKET" && p.symbol) symbols.set(`${p.provider}:${p.symbol}`, { provider: p.provider, symbol: p.symbol });

      for (const { provider, symbol } of symbols.values()) {
        try {
          await this.store(provider, symbol, await this.fetchQuote(provider, symbol));
        } catch (error) {
          this.warn(`Mercado ${symbol}: ${error instanceof Error ? error.message : "falha"}`);
        }
      }
      for (const p of plans) {
        try {
          await evaluatePlanRate(this.pool, p.id);
        } catch (error) {
          this.warn(`Taxa do plano ${p.id}: ${error instanceof Error ? error.message : "falha"}`);
        }
      }
    } catch (error) {
      this.warn(`Ciclo de mercado falhou: ${error instanceof Error ? error.message : "erro"}`);
    } finally {
      this.running = false;
    }
  }

  private warn(message: string): void {
    // No máximo um aviso por minuto, para não encher os registos.
    if (Date.now() - this.lastWarnAt < 60_000) return;
    this.lastWarnAt = Date.now();
    this.log.warn(message);
  }

  /** Guarda o ponto se o preço mudou ou se passou pelo menos 1 minuto desde o último. */
  private async store(provider: string, symbol: string, q: Quote): Promise<void> {
    const last = await latestTick(this.pool, provider, symbol);
    if (last && last.price === q.price && Date.now() - last.at.getTime() < 60_000) return;
    await sql(this.pool, `INSERT INTO market_ticks (provider, symbol, price, prev_close) VALUES ($1, $2, $3, $4)`, [provider, symbol, q.price, q.prevClose]);
  }

  /** Estado do mercado de um plano para o painel: último preço, variação, e pontos novos para o gráfico. */
  async snapshot(plan: { marketProvider: string; marketSymbol: string; marketLabel: string }, since: Date | null): Promise<PlanMarketDto> {
    const latest = await latestTick(this.pool, plan.marketProvider, plan.marketSymbol);
    const rows = since
      ? await sql<{ at: Date; price: number }>(
          this.pool,
          `SELECT at, price::float8 AS price FROM market_ticks WHERE provider = $1 AND symbol = $2 AND at > $3 ORDER BY at ASC LIMIT 500`,
          [plan.marketProvider, plan.marketSymbol, since],
        )
      : await sql<{ at: Date; price: number }>(
          this.pool,
          `SELECT at, price FROM (SELECT at, price::float8 AS price FROM market_ticks WHERE provider = $1 AND symbol = $2 ORDER BY at DESC LIMIT ${SNAPSHOT_POINTS}) t ORDER BY at ASC`,
          [plan.marketProvider, plan.marketSymbol],
        );
    const points: MarketPointDto[] = rows.map((r) => ({ t: r.at.toISOString(), price: r.price }));
    const fresh = latest !== undefined && Date.now() - latest.at.getTime() <= staleSeconds() * 1000;
    return {
      symbol: plan.marketSymbol,
      label: plan.marketLabel || plan.marketSymbol,
      price: latest?.price ?? null,
      changePct: latest && latest.prevClose !== null && latest.prevClose > 0 ? ((latest.price - latest.prevClose) / latest.prevClose) * 100 : null,
      asOf: latest ? latest.at.toISOString() : null,
      stale: !fresh,
      points,
    };
  }

  /** Limpeza: pontos com mais de 3 dias; segmentos de taxa com mais de 60 dias (mantém o último antes do corte). */
  async prune(): Promise<void> {
    await sql(this.pool, `DELETE FROM market_ticks WHERE at < now() - interval '3 days'`);
    await sql(
      this.pool,
      `DELETE FROM plan_rate_segments s
        WHERE s.at < now() - interval '60 days'
          AND EXISTS (SELECT 1 FROM plan_rate_segments n WHERE n.plan_id = s.plan_id AND n.at > s.at AND n.at < now() - interval '60 days')`,
    );
  }

  /** Para o painel de administração: o mercado de um plano está sem dados recentes? */
  async isStale(provider: string, symbol: string): Promise<boolean> {
    const t = await latestTick(this.pool, provider, symbol);
    return !t || Date.now() - t.at.getTime() > staleSeconds() * 1000;
  }
}
