import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApp } from "../app.factory.js";
import type { AppConfig } from "../config/env.js";
import { InMemoryAuthRepository } from "./in-memory-auth.repository.js";
import { PasswordHasher, TEST_SCRYPT_PARAMS } from "./password.service.js";
import { FixedWindowRateLimiter } from "./rate-limiter.js";
import { hashSessionToken, SESSION_COOKIE_NAME } from "./session.service.js";
import { sessionCookieOptions } from "./session-cookie.js";

const ORIGIN = "http://localhost:5173";
const baseConfig: AppConfig = {
  nodeEnv: "test",
  port: 0,
  corsAllowedOrigins: [ORIGIN],
  financialOperationsEnabled: false,
  registrationEnabled: true,
  sessionTtlHours: 168,
  cookieDomain: undefined,
  trustProxyHops: 0,
  databaseUrl: undefined,
  databaseSsl: "off",
  runMigrationsOnStart: false,
  loginIpLimit: 10,
  registerIpLimit: 5,
  enableDiagnostics: false,
};

const PASSWORD = "uma-palavra-passe-longa";
const validRegistration = (email: string) => ({
  fullName: "Maria Teste",
  email,
  password: PASSWORD,
  countryOfResidence: "ao",
  acceptTerms: true,
  acceptPrivacy: true,
});

interface Started {
  app: NestExpressApplication;
  repo: InMemoryAuthRepository;
  base: string;
}

async function start(config: AppConfig = baseConfig): Promise<Started> {
  const repo = new InMemoryAuthRepository();
  const app = await createApp(config, { authRepository: repo });
  await app.listen(0);
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, repo, base: `http://127.0.0.1:${port}` };
}

function post(base: string, path: string, body: unknown, cookie?: string, origin: string = ORIGIN) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function sessionCookieFrom(res: Response): { header: string; pair: string; token: string } {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  assert.ok(header, "esperava o cookie de sessão");
  const pair = header.split(";")[0]!;
  return { header, pair, token: pair.slice(SESSION_COOKIE_NAME.length + 1) };
}

describe("registo", () => {
  let s: Started;
  before(async () => { s = await start(); });
  after(async () => { await s.app.close(); });

  test("regista, normaliza dados e nunca devolve credenciais", async () => {
    const res = await post(s.base, "/v1/auth/register", validRegistration("  Maria@Example.com "));
    assert.equal(res.status, 201);
    const text = await res.text();
    const body = JSON.parse(text) as { data: { user: Record<string, unknown> } };
    assert.equal(body.data.user["email"], "maria@example.com");
    assert.equal(body.data.user["countryOfResidence"], "AO");
    assert.equal(body.data.user["emailVerified"], false);
    assert.ok(!text.includes(PASSWORD));
    assert.ok(!/hash|password/i.test(text), "a resposta não pode conter campos de credenciais");
  });

  test("a palavra-passe fica guardada só como hash scrypt", async () => {
    const stored = [...s.repo.credentials.values()][0]!;
    assert.ok(stored.startsWith("scrypt$"));
    assert.ok(!stored.includes(PASSWORD));
  });

  test("regista consentimentos com data e marcador de versão", () => {
    const types = s.repo.consents.map((c) => c.documentType).sort();
    assert.deepEqual(types, ["privacy", "terms"]);
    assert.ok(s.repo.consents.every((c) => c.documentVersion === "pending-definition" && c.acceptedAt instanceof Date));
  });

  test("email repetido devolve CONFLICT", async () => {
    const res = await post(s.base, "/v1/auth/register", validRegistration("maria@example.com"));
    assert.equal(res.status, 409);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "CONFLICT");
  });

  test("validação devolve códigos por campo sem repetir valores", async () => {
    const res = await post(s.base, "/v1/auth/register", {
      fullName: "",
      email: "x",
      password: "segredo",
      countryOfResidence: "Angola",
      acceptTerms: false,
      acceptPrivacy: true,
    });
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.ok(!text.includes("segredo"));
    const err = (JSON.parse(text) as { error: { code: string; fieldErrors: Array<{ field: string; code: string }> } }).error;
    assert.equal(err.code, "VALIDATION_ERROR");
    const has = (f: string, c: string) => err.fieldErrors.some((e) => e.field === f && e.code === c);
    assert.ok(has("email", "invalidEmail"));
    assert.ok(has("password", "passwordTooShort"));
    assert.ok(has("acceptTerms", "mustAccept"));
    assert.ok(has("countryOfResidence", "invalidCountry"));
  });

  test("palavra-passe gigante é recusada antes de gastar CPU", async () => {
    const res = await post(s.base, "/v1/auth/register", { ...validRegistration("a@b.co"), password: "x".repeat(5000) });
    assert.equal(res.status, 400);
  });

  test("origem não permitida é recusada", async () => {
    const res = await post(s.base, "/v1/auth/register", validRegistration("c@d.co"), undefined, "https://malicioso.example");
    assert.equal(res.status, 403);
  });
});

describe("registo desactivado por defeito", () => {
  test("responde FEATURE_DISABLED", async () => {
    const s = await start({ ...baseConfig, registrationEnabled: false });
    try {
      const res = await post(s.base, "/v1/auth/register", validRegistration("a@b.co"));
      assert.equal(res.status, 403);
      assert.equal(((await res.json()) as { error: { code: string } }).error.code, "FEATURE_DISABLED");
      assert.equal(s.repo.users.size, 0);
    } finally {
      await s.app.close();
    }
  });
});

describe("login, sessão e logout", () => {
  let s: Started;
  before(async () => {
    s = await start();
    await post(s.base, "/v1/auth/register", validRegistration("ana@example.com"));
  });
  after(async () => { await s.app.close(); });

  test("login correcto cria cookie HttpOnly SameSite=Lax e guarda só o hash do token", async () => {
    const res = await post(s.base, "/v1/auth/login", { email: "ANA@example.com", password: PASSWORD });
    assert.equal(res.status, 200);
    const { header, token } = sessionCookieFrom(res);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Lax/i);
    assert.match(header, /Path=\//i);
    assert.ok(!/;\s*Secure/i.test(header), "Secure só em produção");
    assert.equal(token.length, 43);
    const stored = [...s.repo.sessions.values()].find((x) => x.tokenHash === hashSessionToken(token));
    assert.ok(stored, "a sessão deve estar guardada pelo hash");
    assert.ok(![...s.repo.sessions.values()].some((x) => x.tokenHash === token), "o token em claro nunca é guardado");
  });

  test("GET /v1/auth/me com sessão devolve o utilizador", async () => {
    const login = await post(s.base, "/v1/auth/login", { email: "ana@example.com", password: PASSWORD });
    const { pair } = sessionCookieFrom(login);
    const me = await fetch(`${s.base}/v1/auth/me`, { headers: { Cookie: pair } });
    assert.equal(me.status, 200);
    const body = (await me.json()) as { data: { user: { email: string } } };
    assert.equal(body.data.user.email, "ana@example.com");
  });

  test("sem cookie ou com cookie inválido devolve UNAUTHENTICATED", async () => {
    for (const cookie of [undefined, `${SESSION_COOKIE_NAME}=lixo`, `${SESSION_COOKIE_NAME}=${"a".repeat(43)}`]) {
      const res = await fetch(`${s.base}/v1/auth/me`, { headers: cookie ? { Cookie: cookie } : {} });
      assert.equal(res.status, 401);
      assert.equal(((await res.json()) as { error: { code: string } }).error.code, "UNAUTHENTICATED");
    }
  });

  test("password errada e email inexistente dão resposta idêntica", async () => {
    const wrong = await post(s.base, "/v1/auth/login", { email: "ana@example.com", password: "palavra-passe-errada!" });
    const unknown = await post(s.base, "/v1/auth/login", { email: "ninguem@example.com", password: "palavra-passe-errada!" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    const a = (await wrong.json()) as { error: Record<string, unknown> };
    const b = (await unknown.json()) as { error: Record<string, unknown> };
    delete a.error["requestId"];
    delete b.error["requestId"];
    assert.deepEqual(a, b);
    assert.equal(wrong.headers.getSetCookie().length, 0);
  });

  test("logout invalida a sessão e limpa o cookie", async () => {
    const login = await post(s.base, "/v1/auth/login", { email: "ana@example.com", password: PASSWORD });
    const { pair } = sessionCookieFrom(login);
    const out = await post(s.base, "/v1/auth/logout", {}, pair);
    assert.equal(out.status, 200);
    assert.ok(out.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE_NAME}=;`)));
    const me = await fetch(`${s.base}/v1/auth/me`, { headers: { Cookie: pair } });
    assert.equal(me.status, 401);
  });

  test("sessão expirada é recusada e removida", async () => {
    const login = await post(s.base, "/v1/auth/login", { email: "ana@example.com", password: PASSWORD });
    const { pair, token } = sessionCookieFrom(login);
    const key = hashSessionToken(token);
    const rec = s.repo.sessions.get(key)!;
    rec.expiresAt = new Date(Date.now() - 1000);
    const me = await fetch(`${s.base}/v1/auth/me`, { headers: { Cookie: pair } });
    assert.equal(me.status, 401);
    assert.equal(s.repo.sessions.has(key), false);
  });

  test("conta suspensa: login falha com a mesma resposta genérica e sessões existentes deixam de valer", async () => {
    await post(s.base, "/v1/auth/register", validRegistration("susp@example.com"));
    const login = await post(s.base, "/v1/auth/login", { email: "susp@example.com", password: PASSWORD });
    const { pair } = sessionCookieFrom(login);
    const user = [...s.repo.users.values()].find((u) => u.email === "susp@example.com")!;
    user.status = "suspended";
    assert.equal((await fetch(`${s.base}/v1/auth/me`, { headers: { Cookie: pair } })).status, 401);
    const again = await post(s.base, "/v1/auth/login", { email: "susp@example.com", password: PASSWORD });
    assert.equal(again.status, 401);
    assert.equal(((await again.json()) as { error: { code: string } }).error.code, "UNAUTHENTICATED");
  });

  test("a auditoria regista eventos sem palavras-passe nem tokens", () => {
    const actions = new Set(s.repo.audit.map((e) => e.action));
    assert.ok(actions.has("auth.register") && actions.has("auth.login") && actions.has("auth.logout"));
    const dump = JSON.stringify(s.repo.audit);
    assert.ok(!dump.includes(PASSWORD) && !dump.includes("palavra-passe-errada"));
    assert.ok(s.repo.audit.some((e) => e.action === "auth.login" && e.outcome === "failure"));
  });
});

describe("limitação de tentativas", () => {
  test("5 falhas para o mesmo email bloqueiam a 6.ª tentativa, mesmo com a password certa", async () => {
    const s = await start();
    try {
      await post(s.base, "/v1/auth/register", validRegistration("rl@example.com"));
      for (let i = 0; i < 5; i++) {
        const r = await post(s.base, "/v1/auth/login", { email: "rl@example.com", password: "errada-errada-errada" });
        assert.equal(r.status, 401);
      }
      const blocked = await post(s.base, "/v1/auth/login", { email: "rl@example.com", password: PASSWORD });
      assert.equal(blocked.status, 429);
      assert.equal(((await blocked.json()) as { error: { code: string } }).error.code, "RATE_LIMITED");
      assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
    } finally {
      await s.app.close();
    }
  });

  test("mais de 10 tentativas do mesmo IP são bloqueadas", async () => {
    const s = await start();
    try {
      let last = 0;
      for (let i = 0; i < 11; i++) {
        const r = await post(s.base, "/v1/auth/login", { email: `u${i}@example.com`, password: "errada-errada-errada" });
        last = r.status;
      }
      assert.equal(last, 429);
    } finally {
      await s.app.close();
    }
  });

  test("limitador de janela fixa com relógio injectado", () => {
    let now = 0;
    const l = new FixedWindowRateLimiter(2, 1000, () => now);
    assert.equal(l.consume("k").allowed, true);
    assert.equal(l.consume("k").allowed, true);
    const third = l.consume("k");
    assert.equal(third.allowed, false);
    assert.equal(third.retryAfterSeconds, 1);
    now = 1001;
    assert.equal(l.consume("k").allowed, true);
  });
});

describe("palavras-passe", () => {
  const hasher = new PasswordHasher(TEST_SCRYPT_PARAMS);

  test("o mesmo texto gera hashes diferentes (sal) e ambos verificam", async () => {
    const a = await hasher.hash("abc");
    const b = await hasher.hash("abc");
    assert.notEqual(a, b);
    assert.equal(await hasher.verify("abc", a), true);
    assert.equal(await hasher.verify("abd", a), false);
  });

  test("formato inválido devolve false sem lançar", async () => {
    for (const bad of ["", "lixo", "scrypt$1$2$3$x", "bcrypt$a$b$c$d$e", "scrypt$0$8$1$AAAA$AAAA"]) {
      assert.equal(await hasher.verify("abc", bad), false);
    }
  });
});

describe("cookie de sessão", () => {
  test("Secure só em produção; domínio só se configurado", () => {
    assert.equal(sessionCookieOptions({ ...baseConfig, nodeEnv: "production" }).secure, true);
    assert.equal(sessionCookieOptions(baseConfig).secure, false);
    assert.equal(sessionCookieOptions(baseConfig).httpOnly, true);
    assert.equal(sessionCookieOptions({ ...baseConfig, cookieDomain: "kivora.example" }).domain, "kivora.example");
    assert.equal("domain" in sessionCookieOptions(baseConfig), false);
  });
});

describe("arranque", () => {
  test("produção recusa arrancar sem persistência configurada", async () => {
    await assert.rejects(
      createApp({ ...baseConfig, nodeEnv: "production" }),
      /Persistência da autenticação/,
    );
  });
});
