import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { createApp } from "../app.factory.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import { InMemoryAuthRepository } from "../auth/in-memory-auth.repository.js";
import { hashSessionToken, SESSION_COOKIE_NAME } from "../auth/session.service.js";
import type { AppConfig } from "../config/env.js";
import { DEFAULT_MIGRATIONS_DIR, runMigrations } from "./migrate.js";
import { PgAuthRepository } from "./pg-auth.repository.js";

/**
 * Testes contra um PostgreSQL real. Só correm se TEST_DATABASE_URL estiver definida
 * (usar SEMPRE uma base de testes vazia, nunca dados reais). Cada suite usa um esquema próprio.
 */
const URL = process.env["TEST_DATABASE_URL"];
const skip = URL ? false : "TEST_DATABASE_URL não definida";

async function schemaPool(schema: string): Promise<{ pool: pg.Pool; drop: () => Promise<void> }> {
  const admin = new pg.Pool({ connectionString: URL, max: 1 });
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: URL, max: 10, options: `-c search_path=${schema}` });
  return {
    pool,
    drop: async () => {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    },
  };
}

const newSchemaName = () => `test_${randomBytes(4).toString("hex")}`;
const PASSWORD = "uma-palavra-passe-longa";
const HASH = "scrypt$1024$8$1$c2Fs$aGFzaA==";

describe("migrações", { skip }, () => {
  const created: Array<() => Promise<void>> = [];
  after(async () => { for (const d of created) await d(); });

  test("aplica as migrações e é idempotente", async () => {
    const { pool, drop } = await schemaPool(newSchemaName());
    created.push(drop);
    const first = await runMigrations(pool);
    assert.deepEqual(first.applied, ["0001_auth.sql"]);
    const second = await runMigrations(pool);
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.alreadyApplied, ["0001_auth.sql"]);
    const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY 1")).rows.map(
      (r: { table_name: string }) => r.table_name,
    );
    assert.deepEqual(tables, ["audit_events", "consent_records", "credentials", "schema_migrations", "sessions", "users"]);
  });

  test("duas instâncias a arrancar ao mesmo tempo aplicam a migração uma só vez", async () => {
    const { pool, drop } = await schemaPool(newSchemaName());
    created.push(drop);
    const results = await Promise.all([runMigrations(pool), runMigrations(pool), runMigrations(pool)]);
    assert.equal(results.filter((r) => r.applied.length === 1).length, 1);
    const count = await pool.query("SELECT count(*)::int AS n FROM schema_migrations");
    assert.equal(count.rows[0].n, 1);
  });

  test("recusa continuar se uma migração já aplicada for alterada", async () => {
    const { pool, drop } = await schemaPool(newSchemaName());
    created.push(drop);
    const dir = await mkdtemp(`${tmpdir()}/mig-`);
    try {
      await copyFile(`${DEFAULT_MIGRATIONS_DIR}/0001_auth.sql`, `${dir}/0001_auth.sql`);
      await runMigrations(pool, dir);
      await writeFile(`${dir}/0001_auth.sql`, "-- alterada\nSELECT 1;\n");
      await assert.rejects(runMigrations(pool, dir), /foi alterada/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("uma migração com erro faz rollback completo e não fica registada", async () => {
    const { pool, drop } = await schemaPool(newSchemaName());
    created.push(drop);
    const dir = await mkdtemp(`${tmpdir()}/mig-`);
    try {
      await writeFile(`${dir}/0001_bad.sql`, "CREATE TABLE a (id int); CREATE TABLE a (id int);");
      await assert.rejects(runMigrations(pool, dir));
      const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'a'");
      assert.equal(tables.rowCount, 0);
      const registered = await pool.query("SELECT count(*)::int AS n FROM schema_migrations");
      assert.equal(registered.rows[0].n, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

/** O mesmo contrato é verificado na implementação em memória e na PostgreSQL. */
function repositoryContract(name: string, make: () => Promise<{ repo: AuthRepository; cleanup: () => Promise<void> }>, options: { skip?: string | false } = {}) {
  describe(`contrato do repositório — ${name}`, { skip: options.skip ?? false }, () => {
    let repo: AuthRepository;
    let cleanup: () => Promise<void>;
    before(async () => { ({ repo, cleanup } = await make()); });
    after(async () => { await cleanup(); });

    const consents = [
      { documentType: "terms" as const, documentVersion: "pending-definition", acceptedAt: new Date() },
      { documentType: "privacy" as const, documentVersion: "pending-definition", acceptedAt: new Date() },
    ];

    test("cria utilizador activo e não verificado, e encontra-o por email e por id", async () => {
      const user = await repo.createUserWithCredential({ email: "ana@example.com", fullName: "Ana", countryOfResidence: "AO" }, HASH, consents);
      assert.ok(user);
      assert.equal(user.status, "active");
      assert.equal(user.emailVerified, false);
      assert.equal((await repo.findUserByEmail("ana@example.com"))?.id, user.id);
      assert.equal((await repo.findUserById(user.id))?.email, "ana@example.com");
      assert.equal(await repo.getPasswordHash(user.id), HASH);
    });

    test("email repetido devolve null e não altera o original", async () => {
      const again = await repo.createUserWithCredential({ email: "ana@example.com", fullName: "Outra", countryOfResidence: "PT" }, "outro-hash", consents);
      assert.equal(again, null);
      const original = await repo.findUserByEmail("ana@example.com");
      assert.equal(original?.fullName, "Ana");
    });

    test("pedidos simultâneos com o mesmo email: só um é criado", async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          repo.createUserWithCredential({ email: "corrida@example.com", fullName: `N${i}`, countryOfResidence: "AO" }, HASH, consents),
        ),
      );
      assert.equal(results.filter((r) => r !== null).length, 1);
    });

    test("utilizador e sessão inexistentes devolvem null", async () => {
      assert.equal(await repo.findUserByEmail("nao@existe.com"), null);
      assert.equal(await repo.findUserById("00000000-0000-4000-8000-000000000000"), null);
      assert.equal(await repo.getPasswordHash("00000000-0000-4000-8000-000000000000"), null);
      assert.equal(await repo.findSessionByTokenHash("x".repeat(64)), null);
    });

    test("sessões: criar, encontrar pelo hash, apagar", async () => {
      const user = (await repo.findUserByEmail("ana@example.com"))!;
      const expiresAt = new Date(Date.now() + 3_600_000);
      const created = await repo.createSession({ userId: user.id, tokenHash: "h".repeat(64), expiresAt });
      assert.equal(created.userId, user.id);
      const found = await repo.findSessionByTokenHash("h".repeat(64));
      assert.equal(found?.userId, user.id);
      assert.ok(found && Math.abs(found.expiresAt.getTime() - expiresAt.getTime()) < 2);
      await repo.deleteSessionByTokenHash("h".repeat(64));
      assert.equal(await repo.findSessionByTokenHash("h".repeat(64)), null);
    });

    test("auditoria aceita eventos com e sem utilizador e metadados", async () => {
      const user = (await repo.findUserByEmail("ana@example.com"))!;
      await repo.appendAudit({ action: "auth.login", actorUserId: user.id, requestId: "req-1", outcome: "success" });
      await repo.appendAudit({ action: "auth.login", actorUserId: null, requestId: "req-2", outcome: "failure", metadata: { reason: "invalid_credentials", n: 1, ok: false } });
    });

    test("entradas com aspas e SQL são tratadas como texto", async () => {
      const evil = "x'; DROP TABLE users; --@example.com";
      assert.equal(await repo.findUserByEmail(evil), null);
      assert.equal(await repo.findUserByEmail("' OR '1'='1"), null);
      assert.ok(await repo.findUserByEmail("ana@example.com"), "a tabela continua intacta");
    });
  });
}

repositoryContract("em memória", async () => ({ repo: new InMemoryAuthRepository(), cleanup: async () => {} }));

let pgSchemaCleanup: (() => Promise<void>) | undefined;
repositoryContract(
  "PostgreSQL",
  async () => {
    const { pool, drop } = await schemaPool(newSchemaName());
    await runMigrations(pool);
    pgSchemaCleanup = drop;
    return { repo: new PgAuthRepository(pool), cleanup: drop };
  },
  { skip },
);

describe("PostgreSQL: garantias da própria base de dados", { skip }, () => {
  let pool: pg.Pool;
  let repo: PgAuthRepository;
  let drop: () => Promise<void>;
  before(async () => {
    ({ pool, drop } = await schemaPool(newSchemaName()));
    await runMigrations(pool);
    repo = new PgAuthRepository(pool);
  });
  after(async () => { await drop(); });

  test("guarda consentimentos e credencial na mesma transacção que o utilizador", async () => {
    const user = (await repo.createUserWithCredential(
      { email: "t@example.com", fullName: "T", countryOfResidence: "AO" },
      HASH,
      [
        { documentType: "terms", documentVersion: "pending-definition", acceptedAt: new Date() },
        { documentType: "privacy", documentVersion: "pending-definition", acceptedAt: new Date() },
      ],
    ))!;
    const rows = await pool.query("SELECT document_type FROM consent_records WHERE user_id = $1 ORDER BY 1", [user.id]);
    assert.deepEqual(rows.rows.map((r: { document_type: string }) => r.document_type).sort(), ["PRIVACY", "TERMS"]);
  });

  test("falha a meio faz rollback: sem utilizador órfão", async () => {
    await assert.rejects(
      repo.createUserWithCredential(
        { email: "orfao@example.com", fullName: "O", countryOfResidence: "AO" },
        HASH,
        [{ documentType: "terms", documentVersion: "v", acceptedAt: new Date("invalid") }],
      ),
    );
    assert.equal(await repo.findUserByEmail("orfao@example.com"), null);
    const creds = await pool.query("SELECT count(*)::int AS n FROM credentials");
    assert.equal(creds.rows[0].n, 1);
  });

  test("a base recusa emails em maiúsculas e países com tamanho errado", async () => {
    await assert.rejects(pool.query("INSERT INTO users (email, full_name, country_of_residence) VALUES ('MAIUSC@EXAMPLE.COM','x','AO')"), /users_email_lowercase/);
    await assert.rejects(pool.query("INSERT INTO users (email, full_name, country_of_residence) VALUES ('p@example.com','x','ANG')"));
  });

  test("apagar um utilizador apaga credencial e sessões, mas é bloqueado por consentimentos", async () => {
    const u = (await repo.createUserWithCredential({ email: "del@example.com", fullName: "D", countryOfResidence: "AO" }, HASH, []))!;
    await repo.createSession({ userId: u.id, tokenHash: "d".repeat(64), expiresAt: new Date(Date.now() + 1000) });
    await pool.query("DELETE FROM users WHERE id = $1", [u.id]);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM credentials WHERE user_id = $1", [u.id])).rows[0].n, 0);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions WHERE user_id = $1", [u.id])).rows[0].n, 0);

    const t = (await repo.createUserWithCredential({ email: "keep@example.com", fullName: "K", countryOfResidence: "AO" }, HASH, [
      { documentType: "terms", documentVersion: "v", acceptedAt: new Date() },
    ]))!;
    await assert.rejects(pool.query("DELETE FROM users WHERE id = $1", [t.id]), /consent_records/);
  });

  test("sessões expiradas são limpas ao criar novas (no máximo uma vez por hora)", async () => {
    const u = (await repo.findUserByEmail("t@example.com"))!;
    await pool.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, 'expirada', now() - interval '1 day')", [u.id]);
    const fresh = new PgAuthRepository(pool); // instância nova: ainda não limpou nesta hora
    await fresh.createSession({ userId: u.id, tokenHash: "nova".padEnd(64, "n"), expiresAt: new Date(Date.now() + 1000) });
    assert.equal(await fresh.findSessionByTokenHash("expirada"), null);
    // uma segunda criação na mesma hora não volta a limpar
    await pool.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, 'expirada2', now() - interval '1 day')", [u.id]);
    await fresh.createSession({ userId: u.id, tokenHash: "outra".padEnd(64, "o"), expiresAt: new Date(Date.now() + 1000) });
    assert.ok(await fresh.findSessionByTokenHash("expirada2"));
  });
});

describe("fluxo HTTP completo com PostgreSQL", { skip }, () => {
  const ORIGIN = "http://localhost:5173";
  const config: AppConfig = {
    nodeEnv: "test", port: 0, corsAllowedOrigins: [ORIGIN], financialOperationsEnabled: false, registrationEnabled: true,
    sessionTtlHours: 168, cookieDomain: undefined, trustProxyHops: 0, databaseUrl: undefined, databaseSsl: "off",
    runMigrationsOnStart: false, loginIpLimit: 1000, registerIpLimit: 1000, enableDiagnostics: false,
  };
  let pool: pg.Pool; let drop: () => Promise<void>; let base: string;
  let app: Awaited<ReturnType<typeof createApp>>;

  before(async () => {
    ({ pool, drop } = await schemaPool(newSchemaName()));
    await runMigrations(pool);
    app = await createApp(config, { authRepository: new PgAuthRepository(pool) });
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  after(async () => { await app.close(); await drop(); });

  const post = (path: string, body: unknown, cookie?: string) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  const registration = (email: string) => ({ fullName: "Maria", email, password: PASSWORD, countryOfResidence: "AO", acceptTerms: true, acceptPrivacy: true });

  test("registo, login, /me e logout contra a base real", async () => {
    assert.equal((await post("/v1/auth/register", registration("flow@example.com"))).status, 201);
    const login = await post("/v1/auth/login", { email: "flow@example.com", password: PASSWORD });
    assert.equal(login.status, 200);
    const pair = login.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(";")[0]!;
    const token = pair.slice(SESSION_COOKIE_NAME.length + 1);

    const stored = await pool.query("SELECT token_hash FROM sessions");
    assert.deepEqual(stored.rows.map((r: { token_hash: string }) => r.token_hash), [hashSessionToken(token)]);
    const creds = await pool.query("SELECT password_hash FROM credentials");
    assert.ok((creds.rows[0].password_hash as string).startsWith("scrypt$"));

    assert.equal((await fetch(`${base}/v1/auth/me`, { headers: { Cookie: pair } })).status, 200);
    assert.equal((await post("/v1/auth/logout", {}, pair)).status, 200);
    assert.equal((await fetch(`${base}/v1/auth/me`, { headers: { Cookie: pair } })).status, 401);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions")).rows[0].n, 0);

    const audit = await pool.query("SELECT action, outcome FROM audit_events ORDER BY created_at");
    assert.deepEqual(audit.rows.map((r: { action: string; outcome: string }) => `${r.action}:${r.outcome}`), [
      "auth.register:SUCCESS", "auth.login:SUCCESS", "auth.logout:SUCCESS",
    ]);
    assert.ok(!JSON.stringify(audit.rows).includes(PASSWORD));
  });

  test("registos simultâneos com o mesmo email: um 201 e os restantes 409", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => post("/v1/auth/register", registration("race@example.com"))));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409]);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM users WHERE email = 'race@example.com'")).rows[0].n, 1);
  });
});
