import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { Controller, Get, Module } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApp } from "./app.factory.js";
import { AppModule } from "./app.module.js";
import { loadConfig, type AppConfig } from "./config/env.js";

const ALLOWED = "http://localhost:5173";

const config: AppConfig = {
  nodeEnv: "test",
  port: 0,
  corsAllowedOrigins: [ALLOWED],
  financialOperationsEnabled: false,
};

@Controller("boom")
class BoomController {
  @Get()
  boom(): never {
    throw new Error("detalhe-interno-secreto: postgresql://user:pass@host/db");
  }
}

@Module({ imports: [AppModule], controllers: [BoomController] })
class TestModule {}

describe("API — fundação", () => {
  let app: NestExpressApplication;
  let base: string;

  before(async () => {
    app = await createApp(config, TestModule);
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await app.close();
  });

  test("GET /v1/health responde ok no formato do contrato", async () => {
    const res = await fetch(`${base}/v1/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { data: { status: "ok" } });
  });

  test("resposta traz identificador de pedido e cabeçalhos de segurança", async () => {
    const res = await fetch(`${base}/v1/health`);
    assert.match(res.headers.get("x-request-id") ?? "", /^[A-Za-z0-9_-]{8,64}$/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  test("aceita X-Request-Id seguro e substitui um inseguro", async () => {
    const ok = await fetch(`${base}/v1/health`, { headers: { "X-Request-Id": "abc12345-def" } });
    assert.equal(ok.headers.get("x-request-id"), "abc12345-def");

    const bad = await fetch(`${base}/v1/health`, { headers: { "X-Request-Id": "x y\"<script>" } });
    assert.notEqual(bad.headers.get("x-request-id"), "x y\"<script>");
  });

  test("rota inexistente devolve NOT_FOUND uniforme com o mesmo requestId", async () => {
    const res = await fetch(`${base}/v1/nao-existe`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: { code: string; requestId: string; message: string } };
    assert.equal(body.error.code, "NOT_FOUND");
    assert.equal(body.error.requestId, res.headers.get("x-request-id"));
  });

  test("erro inesperado devolve INTERNAL_ERROR sem revelar detalhes", async () => {
    const res = await fetch(`${base}/v1/boom`);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.ok(!text.includes("secreto"), "não pode vazar a mensagem interna");
    assert.ok(!text.includes("postgresql"), "não pode vazar a ligação");
    assert.ok(!text.includes("stack"), "não pode incluir rasto de pilha");
    assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, "INTERNAL_ERROR");
  });

  test("POST com Origin não permitida é recusado (FORBIDDEN)", async () => {
    const res = await fetch(`${base}/v1/health`, {
      method: "POST",
      headers: { Origin: "https://site-malicioso.example", "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 403);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "FORBIDDEN");
  });

  test("POST com Origin permitida passa a verificação (rota não existe para POST)", async () => {
    const res = await fetch(`${base}/v1/health`, {
      method: "POST",
      headers: { Origin: ALLOWED, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 404);
  });

  test("JSON malformado devolve VALIDATION_ERROR no formato do contrato", async () => {
    const res = await fetch(`${base}/v1/health`, {
      method: "POST",
      headers: { Origin: ALLOWED, "Content-Type": "application/json" },
      body: "{isto não é json",
    });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "VALIDATION_ERROR");
  });

  test("CORS só autoriza a origem configurada", async () => {
    const res = await fetch(`${base}/v1/health`, { headers: { Origin: ALLOWED } });
    assert.equal(res.headers.get("access-control-allow-origin"), ALLOWED);
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");

    const other = await fetch(`${base}/v1/health`, { headers: { Origin: "https://outro.example" } });
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  });
});

describe("configuração", () => {
  test("valores por defeito: operações financeiras desactivadas", () => {
    const c = loadConfig({});
    assert.equal(c.nodeEnv, "development");
    assert.equal(c.port, 3000);
    assert.equal(c.financialOperationsEnabled, false);
  });

  test("só o valor exacto 'true' activa operações financeiras", () => {
    for (const v of ["TRUE", "1", "yes", "", "false"]) {
      assert.equal(loadConfig({ FEATURE_FINANCIAL_OPERATIONS_ENABLED: v }).financialOperationsEnabled, false);
    }
    assert.equal(loadConfig({ FEATURE_FINANCIAL_OPERATIONS_ENABLED: "true" }).financialOperationsEnabled, true);
  });

  test("rejeita NODE_ENV e API_PORT inválidos sem repetir o valor", () => {
    assert.throws(() => loadConfig({ NODE_ENV: "staging-secreto" }), (e: Error) => !e.message.includes("staging-secreto"));
    assert.throws(() => loadConfig({ API_PORT: "abc" }));
    assert.throws(() => loadConfig({ API_PORT: "70000" }));
  });

  test("produção exige CORS_ALLOWED_ORIGINS", () => {
    assert.throws(() => loadConfig({ NODE_ENV: "production" }));
    const c = loadConfig({ NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://a.example, https://b.example" });
    assert.deepEqual(c.corsAllowedOrigins, ["https://a.example", "https://b.example"]);
  });
});
