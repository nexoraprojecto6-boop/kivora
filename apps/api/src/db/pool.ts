import { Logger } from "@nestjs/common";
import pg from "pg";
import type { AppConfig } from "../config/env.js";

/** Cria o conjunto de ligações PostgreSQL a partir da configuração. */
export function createPool(config: AppConfig, extra: pg.PoolConfig = {}): pg.Pool {
  if (!config.databaseUrl) throw new Error("DATABASE_URL não configurada.");
  const ssl =
    config.databaseSsl === "off" ? false : config.databaseSsl === "no-verify" ? { rejectUnauthorized: false } : true;
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...extra,
  });
  // Erros em ligações paradas não podem derrubar o processo.
  pool.on("error", (error) => new Logger("Database").error(`Erro numa ligação inactiva: ${error.name}`));
  return pool;
}
