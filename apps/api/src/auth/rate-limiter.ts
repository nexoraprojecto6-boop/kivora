export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Limitador de janela fixa, em memória. Adequado a uma única instância.
 * Com várias instâncias será preciso um armazenamento partilhado.
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Regista uma tentativa. Devolve se continua permitida. */
  consume(key: string): RateLimitResult {
    const t = this.now();
    this.sweep(t);
    let w = this.windows.get(key);
    if (!w || w.resetAt <= t) {
      w = { count: 0, resetAt: t + this.windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    if (w.count > this.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - t) / 1000)) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Indica se a chave já atingiu o limite, sem registar nova tentativa. */
  isBlocked(key: string): RateLimitResult {
    const t = this.now();
    const w = this.windows.get(key);
    if (w && w.resetAt > t && w.count >= this.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - t) / 1000)) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Limpeza preguiçosa para a memória não crescer sem limite. */
  private sweep(t: number): void {
    if (this.windows.size < 10_000) return;
    for (const [k, w] of this.windows) if (w.resetAt <= t) this.windows.delete(k);
  }
}
