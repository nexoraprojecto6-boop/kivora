import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

/** Pasta das migrações SQL (apps/api/migrations), relativa a este ficheiro compilado. */
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations/", import.meta.url));

const LOCK_KEY = 727_274_001; // chave arbitrária do bloqueio consultivo

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

/**
 * Aplica as migrações SQL por ordem de nome, uma transacção por ficheiro.
 * - Bloqueio consultivo: duas instâncias a arrancar ao mesmo tempo não aplicam em duplicado.
 * - Guarda o SHA-256 de cada migração aplicada e recusa continuar se um ficheiro já aplicado for alterado.
 */
export async function runMigrations(pool: Pool, dir: string = DEFAULT_MIGRATIONS_DIR): Promise<MigrationResult> {
  const client = await pool.connect();
  const result: MigrationResult = { applied: [], alreadyApplied: [] };
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )`);

    const files = (await readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
    const done = new Map<string, string>(
      (await client.query<{ version: string; checksum: string }>("SELECT version, checksum FROM schema_migrations")).rows.map(
        (r) => [r.version, r.checksum],
      ),
    );

    for (const file of files) {
      const sql = await readFile(`${dir}/${file}`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = done.get(file);
      if (existing !== undefined) {
        if (existing !== checksum) {
          throw new Error(`A migração ${file} já foi aplicada e foi alterada depois. Crie uma nova migração em vez de editar.`);
        }
        result.alreadyApplied.push(file);
        continue;
      }
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [file, checksum]);
        await client.query("COMMIT");
        result.applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return result;
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } finally {
      client.release();
    }
  }
}
