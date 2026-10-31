import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { API_ERROR_CODE, API_VERSION_PREFIX } from "@kivora/shared";
import { Client, type ClientConfig, type Pool } from "pg";
import { WebSocketServer, type WebSocket } from "ws";
import { ApiException } from "../common/api-error.js";
import type { AppConfig } from "../config/env.js";
import { APP_CONFIG } from "../config/tokens.js";
import { PG_POOL } from "./finance.config.js";
import { PaymentsService } from "./payments.service.js";
import { isScope, scopesFor } from "./realtime-events.js";
import { one, sql } from "./sql.js";

/*
 * Tempo real por WebSocket (só o servidor decide o que o cliente vê).
 *  - Ligação: o cliente pede um bilhete (POST /v1/realtime/ticket, com a sessão), liga-se e envia-o na PRIMEIRA mensagem
 *    ({"t":"auth","ticket":...}): uso único, 30 s, ligado à sessão. Nada de bilhete no endereço; cookie e token da sessão
 *    nunca vão no WebSocket. A origem (Origin) tem de estar em CORS_ALLOWED_ORIGINS. Sem autenticação em 5 s a ligação fecha.
 *  - Só o servidor envia dados. Do cliente só aceita {"t":"ping"} (máximo 512 bytes, 20 mensagens por 10 s).
 *  - Cada utilizador só recebe os eventos dele; a equipa recebe também os avisos de fila de trabalho.
 *  - Eventos: saem de triggers da base de dados (NOTIFY depois do COMMIT), por isso funcionam com várias instâncias da API.
 *  - A sessão é revista de minuto a minuto e o logout fecha as ligações dessa sessão de imediato.
 */
const PATH = `${API_VERSION_PREFIX}/ws`;
const TICKET_TTL_S = 30;
const MAX_PER_USER = 5;
const MAX_TOTAL = 10_000;
const MAX_UPGRADES_PER_IP_PER_MIN = 30;
const PING_MS = 25_000;
const RECHECK_MS = 60_000;
const AUTH_TIMEOUT_MS = 5_000;
const MAX_PENDING = 2_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Conn { ws: WebSocket; userId: string; staff: boolean; sessionHash: string; alive: boolean; msgs: number; windowAt: number }
const sha256 = (v: string): string => createHash("sha256").update(v).digest("hex");

@Injectable()
export class RealtimeService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(RealtimeService.name);
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 512, perMessageDeflate: false });
  private readonly byUser = new Map<string, Set<Conn>>();
  private readonly walletTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly staffTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly upgrades = new Map<string, { n: number; at: number }>();
  private readonly origins: Set<string>;
  private total = 0;
  private pending = 0;
  private listener: Client | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 1000;
  private hadListener = false;
  private timers: ReturnType<typeof setInterval>[] = [];
  private closed = false;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly adapter: HttpAdapterHost,
    private readonly payments: PaymentsService,
  ) {
    this.origins = new Set(config.corsAllowedOrigins);
  }

  onApplicationBootstrap(): void {
    const server = this.adapter.httpAdapter.getHttpServer() as import("node:http").Server;
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this.onUpgrade(req, socket, head).catch(() => this.reject(socket, 500));
    });
    this.timers.push(setInterval(() => this.heartbeat(), PING_MS), setInterval(() => void this.recheck(), RECHECK_MS));
    void this.listen();
  }

  onModuleDestroy(): void {
    this.closed = true;
    for (const t of this.timers) clearInterval(t);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    for (const set of this.byUser.values()) for (const c of set) c.ws.close(1001, "shutdown");
    this.wss.close();
    void this.listener?.end().catch(() => undefined);
  }

  /* ---------- bilhetes ---------- */

  async issueTicket(userId: string, sessionToken: string): Promise<{ ticket: string; expiresInSeconds: number }> {
    await sql(this.pool, "DELETE FROM realtime_tickets WHERE expires_at < now()");
    const open = await one<{ n: number }>(this.pool, "SELECT count(*)::int AS n FROM realtime_tickets WHERE user_id = $1", [userId]);
    if ((open?.n ?? 0) >= 20) throw new ApiException(API_ERROR_CODE.RATE_LIMITED);
    const ticket = randomBytes(32).toString("base64url");
    await sql(this.pool, `INSERT INTO realtime_tickets (hash, user_id, session_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(secs => $4::int))`, [sha256(ticket), userId, sha256(sessionToken), TICKET_TTL_S]);
    return { ticket, expiresInSeconds: TICKET_TTL_S };
  }

  /* ---------- ligação ---------- */

  private reject(socket: Duplex, status: number): void {
    const text = status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : status === 404 ? "Not Found" : status === 429 ? "Too Many Requests" : status === 503 ? "Service Unavailable" : "Error";
    try {
      socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    } finally {
      socket.destroy();
    }
  }

  private originAllowed(origin: string | undefined): boolean {
    if (!origin) return false; // os navegadores enviam sempre Origin no WebSocket
    if (this.origins.has(origin)) return true;
    if (this.config.nodeEnv !== "production" && this.origins.size === 0) {
      try {
        const h = new URL(origin).hostname;
        return h === "localhost" || h === "127.0.0.1";
      } catch {
        return false;
      }
    }
    return false;
  }

  private ipAllowed(ip: string): boolean {
    const now = Date.now();
    const e = this.upgrades.get(ip);
    if (!e || now - e.at > 60_000) {
      this.upgrades.set(ip, { n: 1, at: now });
      if (this.upgrades.size > 5000) for (const [k, v] of this.upgrades) if (now - v.at > 60_000) this.upgrades.delete(k);
      return true;
    }
    e.n += 1;
    return e.n <= MAX_UPGRADES_PER_IP_PER_MIN;
  }

  /**
   * O bilhete NÃO vai no endereço (não fica em registos de proxies): o cliente liga-se e envia {"t":"auth","ticket":"..."} como
   * primeira mensagem. Sem autenticação em 5 s, ou com outra mensagem primeiro, a ligação fecha (4401).
   */
  private async onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== PATH) return this.reject(socket, 404);
    if (!this.originAllowed(req.headers.origin)) return this.reject(socket, 403);
    const ip = (req.socket.remoteAddress ?? "?") + "|" + (this.config.trustProxyHops > 0 ? String(req.headers["x-forwarded-for"] ?? "").split(",").at(-1)?.trim() ?? "" : "");
    if (!this.ipAllowed(ip)) return this.reject(socket, 429);
    if (this.total + this.pending >= MAX_TOTAL || this.pending >= MAX_PENDING) return this.reject(socket, 503);
    this.pending += 1;
    this.wss.handleUpgrade(req, socket, head, (ws) => this.onSocket(ws));
  }

  /** Uso único: o bilhete é apagado ao ser consumido. */
  private async authenticate(ticket: string): Promise<{ userId: string; staff: boolean; sessionHash: string } | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
    const t = await one<{ userId: string; sessionHash: string }>(this.pool, `DELETE FROM realtime_tickets WHERE hash = $1 AND expires_at > now() RETURNING user_id AS "userId", session_hash AS "sessionHash"`, [sha256(ticket)]);
    if (!t) return null;
    const u = await one<{ role: string; status: string }>(
      this.pool,
      `SELECT u.role::text AS role, u.status::text AS status FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.user_id = $2 AND s.expires_at > now()`,
      [t.sessionHash, t.userId],
    );
    if (!u || u.status === "SUSPENDED") return null;
    return { userId: t.userId, staff: u.role === "ADMIN" || u.role === "SUPPORT", sessionHash: t.sessionHash };
  }

  private onSocket(ws: WebSocket): void {
    let conn: Conn | null = null;
    let authing = false;
    let released = false;
    const release = (): void => { if (!released) { released = true; this.pending -= 1; } };
    const timer = setTimeout(() => { if (!conn) ws.close(4401, "auth"); }, AUTH_TIMEOUT_MS);
    ws.on("error", () => undefined);
    ws.on("close", () => {
      clearTimeout(timer);
      release();
      if (conn) {
        this.total -= 1;
        const s = this.byUser.get(conn.userId);
        s?.delete(conn);
        if (s && s.size === 0) this.byUser.delete(conn.userId);
      }
    });
    ws.on("message", (data, isBinary) => {
      if (isBinary) return ws.close(1003, "text only");
      let m: { t?: unknown; ticket?: unknown };
      try {
        m = JSON.parse(data.toString()) as typeof m;
      } catch {
        return ws.close(1003, "bad message");
      }
      if (!conn) {
        if (authing || m.t !== "auth" || typeof m.ticket !== "string") return ws.close(4401, "auth");
        authing = true;
        void this.authenticate(m.ticket).then(
          (who) => {
            if (!who || ws.readyState !== 1) return ws.close(4401, "auth");
            if ((this.byUser.get(who.userId)?.size ?? 0) >= MAX_PER_USER) return ws.close(4429, "limit");
            clearTimeout(timer);
            release();
            conn = this.register(ws, who);
          },
          () => ws.close(1011, "error"),
        );
        return;
      }
      const now = Date.now();
      if (now - conn.windowAt > 10_000) { conn.windowAt = now; conn.msgs = 0; }
      if (++conn.msgs > 20) return ws.close(4429, "rate");
      if (m.t === "ping") this.send(conn, { type: "pong", at: now });
    });
  }

  private register(ws: WebSocket, who: { userId: string; staff: boolean; sessionHash: string }): Conn {
    const c: Conn = { ws, ...who, alive: true, msgs: 0, windowAt: Date.now() };
    let set = this.byUser.get(c.userId);
    if (!set) this.byUser.set(c.userId, (set = new Set()));
    set.add(c);
    this.total += 1;
    ws.on("pong", () => { c.alive = true; });
    this.send(c, { type: "hello", serverTime: new Date().toISOString(), staff: c.staff });
    void this.pushWallet(c.userId);
    return c;
  }

  private send(c: Conn, msg: Record<string, unknown>): void {
    if (c.ws.readyState !== 1 || c.ws.bufferedAmount > 1_000_000) return;
    c.ws.send(JSON.stringify(msg));
  }

  private toUser(userId: string, msg: Record<string, unknown>): void {
    const set = this.byUser.get(userId);
    if (set) for (const c of set) this.send(c, msg);
  }

  private heartbeat(): void {
    for (const set of this.byUser.values()) {
      for (const c of set) {
        if (!c.alive) { c.ws.terminate(); continue; }
        c.alive = false;
        try { c.ws.ping(); } catch { c.ws.terminate(); }
      }
    }
    if (this.listener) void this.listener.query("SELECT 1").catch(() => undefined);
  }

  /** Revê as sessões: expirada ou conta suspensa fecha a ligação. */
  private async recheck(): Promise<void> {
    const hashes = new Map<string, Set<Conn>>();
    for (const set of this.byUser.values()) for (const c of set) hashes.set(c.sessionHash, (hashes.get(c.sessionHash) ?? new Set()).add(c));
    if (hashes.size === 0) return;
    try {
      const ok = await sql<{ h: string }>(
        this.pool,
        `SELECT s.token_hash AS h FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ANY($1::text[]) AND s.expires_at > now() AND u.status <> 'SUSPENDED'`,
        [[...hashes.keys()]],
      );
      const valid = new Set(ok.map((r) => r.h));
      for (const [h, set] of hashes) if (!valid.has(h)) for (const c of set) c.ws.close(4401, "session");
    } catch (error) {
      this.log.warn(`revisão de sessões falhou: ${error instanceof Error ? error.message : "erro"}`);
    }
  }

  /* ---------- eventos vindos da base de dados ---------- */

  private async listen(): Promise<void> {
    if (this.closed) return;
    // Com pooler de ligações (modo transacção) o LISTEN não funciona: usar REALTIME_DATABASE_URL com a ligação directa.
    const url = process.env["REALTIME_DATABASE_URL"]?.trim();
    const client = new Client(url ? { connectionString: url, ssl: (this.pool.options as ClientConfig).ssl } : (this.pool.options as ClientConfig));
    client.on("error", () => undefined);
    client.on("end", () => { if (this.listener === client) { this.listener = null; this.scheduleReconnect(); } });
    client.on("notification", (m) => { if (m.channel === "kivora_rt" && m.payload) this.onEvent(m.payload); });
    try {
      await client.connect();
      await client.query("LISTEN kivora_rt");
      this.listener = client;
      this.backoff = 1000;
      // Depois de uma falha podem ter-se perdido eventos: o cliente volta a pedir tudo.
      if (this.hadListener) for (const set of this.byUser.values()) for (const c of set) this.send(c, { type: "resync" });
      this.hadListener = true;
    } catch (error) {
      void client.end().catch(() => undefined);
      this.log.warn(`LISTEN indisponível: ${error instanceof Error ? error.message : "erro"}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; void this.listen(); }, this.backoff + Math.floor(Math.random() * 400));
    this.backoff = Math.min(30_000, this.backoff * 2);
  }

  private onEvent(payload: string): void {
    let e: { k?: string; u?: string; t?: string; id?: string; s?: string; h?: string };
    try { e = JSON.parse(payload) as typeof e; } catch { return; }
    const user = typeof e.u === "string" && UUID.test(e.u) ? e.u : null;
    switch (e.k) {
      case "wallet":
        if (user && this.byUser.has(user)) this.schedule(this.walletTimers, user, 200, () => void this.pushWallet(user));
        break;
      case "notification":
        if (user && this.byUser.has(user) && typeof e.t === "string") this.toUser(user, { type: "notification", id: typeof e.id === "string" ? e.id : null, kind: e.t.slice(0, 60), scopes: scopesFor(e.t) });
        break;
      case "refresh":
        if (user && this.byUser.has(user) && isScope(e.s)) this.toUser(user, { type: "refresh", scope: e.s });
        break;
      case "staff":
        if (typeof e.s === "string" && /^[a-z_]{3,30}$/.test(e.s)) {
          const scope = e.s;
          this.schedule(this.staffTimers, scope, 300, () => { for (const set of this.byUser.values()) for (const c of set) if (c.staff) this.send(c, { type: "staff", scope }); });
        }
        break;
      case "session":
        if (user && typeof e.h === "string") for (const c of this.byUser.get(user) ?? []) if (c.sessionHash === e.h) c.ws.close(4401, "session");
        break;
    }
  }

  private schedule(map: Map<string, ReturnType<typeof setTimeout>>, key: string, ms: number, fn: () => void): void {
    if (map.has(key)) return;
    map.set(key, setTimeout(() => { map.delete(key); fn(); }, ms));
  }

  /** Saldo actual, calculado no servidor (a mesma conta do GET /wallet). */
  private async pushWallet(userId: string): Promise<void> {
    if (!this.byUser.has(userId)) return;
    try {
      this.toUser(userId, { type: "wallet", wallet: await this.payments.wallet(userId), at: new Date().toISOString() });
    } catch (error) {
      this.log.warn(`saldo em tempo real falhou: ${error instanceof Error ? error.message : "erro"}`);
    }
  }
}
