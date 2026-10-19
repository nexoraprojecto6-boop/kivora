import { test } from "node:test";
import assert from "node:assert/strict";
import { loginSchema, registerSchema, toFieldErrors, PASSWORD_MAX_LENGTH } from "./auth.js";

const valid = {
  fullName: "  Maria Teste  ",
  email: "  Maria@Example.COM ",
  password: "uma-palavra-passe-longa",
  countryOfResidence: "ao",
  acceptTerms: true,
  acceptPrivacy: true,
};

test("registo válido normaliza email, nome e país", () => {
  const r = registerSchema.parse(valid);
  assert.equal(r.email, "maria@example.com");
  assert.equal(r.fullName, "Maria Teste");
  assert.equal(r.countryOfResidence, "AO");
});

test("registo inválido devolve códigos estáveis por campo", () => {
  const r = registerSchema.safeParse({
    fullName: "",
    email: "nao-e-email",
    password: "curta",
    countryOfResidence: "Angola",
    acceptTerms: false,
  });
  assert.equal(r.success, false);
  if (r.success) return;
  const errs = toFieldErrors(r.error);
  const has = (field: string, code: string) => errs.some((e) => e.field === field && e.code === code);
  assert.ok(has("fullName", "required"));
  assert.ok(has("email", "invalidEmail"));
  assert.ok(has("password", "passwordTooShort"));
  assert.ok(has("countryOfResidence", "invalidCountry"));
  assert.ok(has("acceptTerms", "mustAccept"));
  assert.ok(has("acceptPrivacy", "required") || has("acceptPrivacy", "mustAccept"));
});

test("campos em falta contam como 'required'", () => {
  const r = loginSchema.safeParse({});
  assert.equal(r.success, false);
  if (r.success) return;
  const errs = toFieldErrors(r.error);
  assert.ok(errs.some((e) => e.field === "email" && e.code === "required"));
  assert.ok(errs.some((e) => e.field === "password" && e.code === "required"));
});

test("palavra-passe acima do limite é recusada", () => {
  const r = loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(PASSWORD_MAX_LENGTH + 1) });
  assert.equal(r.success, false);
});

test("erros não repetem valores enviados pelo cliente", () => {
  const r = registerSchema.safeParse({ ...valid, password: "segredo" });
  assert.equal(r.success, false);
  if (r.success) return;
  assert.ok(!JSON.stringify(toFieldErrors(r.error)).includes("segredo"));
});
