import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApp } from "../app.factory.js";
import type { AppConfig } from "../config/env.js";
import { InMemoryAuthRepository } from "./in-memory-auth.repository.js";
import { hashSessionToken as sha, SESSION_COOKIE_NAME } from "./session.service.js";

const ORIGIN = "http://localhost:5173";
const config: AppConfig = {
  nodeEnv: "test", port: 0, corsAllowedOrigins: [ORIGIN], financialOperationsEnabled: false, registrationEnabled: true,
  sessionTtlHours: 168, cookieDomain: undefined, trustProxyHops: 0, databaseUrl: undefined, databaseSsl: "off",
  runMigrationsOnStart: false, loginIpLimit: 1000, registerIpLimit: 1000, enableDiagnostics: false,
};
const PASSWORD = "uma-palavra-passe-longa";
const NEW_PASSWORD = "outra-palavra-passe-bem-longa";

interface Ctx { app: NestExpressApplication; repo: InMemoryAuthRepository; base: string }
async function start(): Promise<Ctx> {
  const repo = new InMemoryAuthRepository();
  const app = await createApp(config, { authRepository: repo });
  await app.listen(0);
  return { app, repo, base: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}` };
}

const req = (c: Ctx, method: string, path: string, opts: { body?: unknown; cookie?: string; origin?: string } = {}) =>
  fetch(`${c.base}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      Origin: opts.origin ?? ORIGIN,
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

async function register(c: Ctx, email: string) {
  const r = await req(c, "POST", "/v1/auth/register", {
    body: { fullName: "Teste", email, password: PASSWORD, countryOfResidence: "AO", acceptTerms: true, acceptPrivacy: true },
  });
  assert.equal(r.status, 201);
}
async function login(c: Ctx, email: string, password = PASSWORD): Promise<string> {
  const r = await req(c, "POST", "/v1/auth/login", { body: { email, password } });
  assert.equal(r.status, 200);
  return r.headers.getSetCookie().find((x) => x.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(";")[0]!;
}
const status = async (c: Ctx, cookie: string) => (await req(c, "GET", "/v1/auth/me", { cookie })).status;

describe("sessões abertas", () => {
  let c: Ctx;
  before(async () => { c = await start(); await register(c, "ana@example.com"); await register(c, "bruno@example.com"); });
  after(async () => { await c.app.close(); });

  test("exige sessão", async () => {
    for (const [m, p] of [["GET", "/v1/auth/sessions"], ["POST", "/v1/auth/sessions/revoke-others"], ["DELETE", "/v1/auth/sessions/x"], ["POST", "/v1/auth/change-password"]] as const) {
      const r = await req(c, m, p, m === "POST" ? { body: {} } : {});
      assert.equal(r.status, 401, `${m} ${p}`);
    }
  });

  test("lista só as sessões do próprio, marca a actual e nunca expõe tokens", async () => {
    const a1 = await login(c, "ana@example.com");
    const a2 = await login(c, "ana@example.com");
    await login(c, "bruno@example.com");
    const r = await req(c, "GET", "/v1/auth/sessions", { cookie: a1 });
    assert.equal(r.status, 200);
    const text = await r.text();
    const body = JSON.parse(text) as { data: { sessions: Array<{ id: string; current: boolean; createdAt: string; expiresAt: string }> } };
    assert.equal(body.data.sessions.length, 2);
    assert.equal(body.data.sessions.filter((s) => s.current).length, 1);
    assert.ok(!text.includes(a1.split("=")[1]!) && !text.includes(a2.split("=")[1]!), "não pode incluir tokens");
    assert.ok(!/tokenHash|token_hash/.test(text));
    assert.ok(body.data.sessions.every((s) => !Number.isNaN(Date.parse(s.expiresAt))));
  });

  test("terminar outra sessão invalida só essa; a actual continua", async () => {
    const a1 = await login(c, "ana@example.com");
    const a2 = await login(c, "ana@example.com");
    const a2Id = ((await (await req(c, "GET", "/v1/auth/sessions", { cookie: a2 })).json()) as { data: { sessions: Array<{ id: string; current: boolean }> } })
      .data.sessions.find((s) => s.current)!.id;
    const del = await req(c, "DELETE", `/v1/auth/sessions/${a2Id}`, { cookie: a1 });
    assert.equal(del.status, 200);
    assert.equal(await status(c, a2), 401, "a sessão terminada deixa de valer");
    assert.equal(await status(c, a1), 200, "a sessão actual continua");
  });

  test("não se termina a sessão de outra pessoa nem ids inexistentes ou inválidos", async () => {
    const a = await login(c, "ana@example.com");
    const b = await login(c, "bruno@example.com");
    const bList = (await (await req(c, "GET", "/v1/auth/sessions", { cookie: b })).json()) as { data: { sessions: Array<{ id: string; current: boolean }> } };
    const bId = bList.data.sessions.find((s) => s.current)!.id;
    for (const id of [bId, "00000000-0000-4000-8000-000000000000", "nao-e-uuid", "1 OR 1=1"]) {
      const r = await req(c, "DELETE", `/v1/auth/sessions/${encodeURIComponent(id)}`, { cookie: a });
      assert.equal(r.status, 404, id);
      assert.equal(((await r.json()) as { error: { code: string } }).error.code, "NOT_FOUND");
    }
    assert.equal(await status(c, b), 200, "a sessão do Bruno continua válida");
  });

  test("terminar todas as outras sessões mantém só a actual", async () => {
    const x1 = await login(c, "ana@example.com");
    const x2 = await login(c, "ana@example.com");
    const x3 = await login(c, "ana@example.com");
    const r = await req(c, "POST", "/v1/auth/sessions/revoke-others", { cookie: x2, body: {} });
    assert.equal(r.status, 200);
    assert.ok(((await r.json()) as { data: { revokedSessions: number } }).data.revokedSessions >= 2);
    assert.equal(await status(c, x2), 200);
    assert.equal(await status(c, x1), 401);
    assert.equal(await status(c, x3), 401);
    const list = (await (await req(c, "GET", "/v1/auth/sessions", { cookie: x2 })).json()) as { data: { sessions: unknown[] } };
    assert.equal(list.data.sessions.length, 1);
  });

  test("sessões expiradas não aparecem na lista", async () => {
    const bruno = [...c.repo.users.values()].find((u) => u.email === "bruno@example.com")!;
    const expiring = await login(c, "bruno@example.com");
    const current = await login(c, "bruno@example.com");
    const before = (await (await req(c, "GET", "/v1/auth/sessions", { cookie: current })).json()) as { data: { sessions: unknown[] } };
    // expira à força a sessão "expiring" (a que não é a actual)
    const victim = [...c.repo.sessions.values()].filter((s) => s.userId === bruno.id).find((s) => s.tokenHash === sha(expiring.split("=")[1]!))!;
    victim.expiresAt = new Date(Date.now() - 1000);
    const after = (await (await req(c, "GET", "/v1/auth/sessions", { cookie: current })).json()) as { data: { sessions: Array<{ id: string; current: boolean }> } };
    assert.equal(after.data.sessions.length, before.data.sessions.length - 1);
    assert.ok(!after.data.sessions.some((s) => s.id === victim.id));
    assert.ok(after.data.sessions.some((s) => s.current));
  });

  test("origem não permitida é recusada em DELETE e POST", async () => {
    const a = await login(c, "ana@example.com");
    assert.equal((await req(c, "DELETE", "/v1/auth/sessions/00000000-0000-4000-8000-000000000000", { cookie: a, origin: "https://malicioso.example" })).status, 403);
    assert.equal((await req(c, "POST", "/v1/auth/sessions/revoke-others", { cookie: a, body: {}, origin: "https://malicioso.example" })).status, 403);
    assert.equal(await status(c, a), 200);
  });
});

describe("alterar palavra-passe", () => {
  let c: Ctx;
  before(async () => { c = await start(); });
  after(async () => { await c.app.close(); });

  test("palavra-passe actual errada: erro no campo, nada muda e fica auditado sem segredos", async () => {
    await register(c, "pw1@example.com");
    const cookie = await login(c, "pw1@example.com");
    const r = await req(c, "POST", "/v1/auth/change-password", { cookie, body: { currentPassword: "errada-errada-errada", newPassword: NEW_PASSWORD } });
    assert.equal(r.status, 400);
    const err = ((await r.json()) as { error: { code: string; fieldErrors: Array<{ field: string; code: string }> } }).error;
    assert.equal(err.code, "VALIDATION_ERROR");
    assert.deepEqual(err.fieldErrors, [{ field: "currentPassword", code: "invalidCredentials" }]);
    await login(c, "pw1@example.com", PASSWORD); // a antiga continua a servir
    const dump = JSON.stringify(c.repo.audit);
    assert.ok(c.repo.audit.some((e) => e.action === "auth.password_change" && e.outcome === "failure"));
    assert.ok(!dump.includes("errada-errada") && !dump.includes(NEW_PASSWORD) && !dump.includes(PASSWORD));
  });

  test("validação: igual à actual e demasiado curta", async () => {
    await register(c, "pw2@example.com");
    const cookie = await login(c, "pw2@example.com");
    const same = await req(c, "POST", "/v1/auth/change-password", { cookie, body: { currentPassword: PASSWORD, newPassword: PASSWORD } });
    assert.equal(same.status, 400);
    assert.ok(JSON.stringify(await same.json()).includes("sameAsCurrent"));
    const short = await req(c, "POST", "/v1/auth/change-password", { cookie, body: { currentPassword: PASSWORD, newPassword: "curta" } });
    assert.ok(JSON.stringify(await short.json()).includes("passwordTooShort"));
  });

  test("sucesso: nova palavra-passe vale, a antiga deixa de valer e as outras sessões terminam", async () => {
    await register(c, "pw3@example.com");
    const keep = await login(c, "pw3@example.com");
    const other1 = await login(c, "pw3@example.com");
    const other2 = await login(c, "pw3@example.com");
    const r = await req(c, "POST", "/v1/auth/change-password", { cookie: keep, body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    assert.equal(r.status, 200);
    assert.equal(((await r.json()) as { data: { revokedSessions: number } }).data.revokedSessions, 2);
    assert.equal(await status(c, keep), 200);
    assert.equal(await status(c, other1), 401);
    assert.equal(await status(c, other2), 401);
    assert.equal((await req(c, "POST", "/v1/auth/login", { body: { email: "pw3@example.com", password: PASSWORD } })).status, 401);
    assert.equal((await req(c, "POST", "/v1/auth/login", { body: { email: "pw3@example.com", password: NEW_PASSWORD } })).status, 200);
    const stored = [...c.repo.credentials.values()].filter((h) => h.startsWith("scrypt$"));
    assert.ok(stored.every((h) => !h.includes(NEW_PASSWORD)));
    assert.ok(c.repo.audit.some((e) => e.action === "auth.password_change" && e.outcome === "success"));
  });

  test("5 tentativas falhadas bloqueiam novas tentativas, mesmo com a palavra-passe certa", async () => {
    await register(c, "pw4@example.com");
    const cookie = await login(c, "pw4@example.com");
    for (let i = 0; i < 5; i++) {
      const r = await req(c, "POST", "/v1/auth/change-password", { cookie, body: { currentPassword: "errada-errada-errada", newPassword: NEW_PASSWORD } });
      assert.equal(r.status, 400);
    }
    const blocked = await req(c, "POST", "/v1/auth/change-password", { cookie, body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  });
});
