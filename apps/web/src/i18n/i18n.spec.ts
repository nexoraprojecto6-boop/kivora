import { describe, expect, test } from "vitest";
import { RESOURCES, SUPPORTED_LANGUAGES, type LanguageCode } from "./resources";
import { translate } from "./translate";
import languages from "./config/languages.json";

/** Lista todas as chaves de folha de um objecto, no formato "a.b.c". */
function leafKeys(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([k, v]) => leafKeys(v, prefix ? `${prefix}.${k}` : k));
}

function leafValues(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (node === null || typeof node !== "object") return [];
  return Object.values(node).flatMap(leafValues);
}

const codes = SUPPORTED_LANGUAGES.map((l) => l.code);

describe("internacionalização", () => {
  test("os quatro idiomas previstos estão configurados, português por defeito", () => {
    expect(codes).toEqual(["pt", "en", "fr", "es"]);
    expect(languages.defaultLanguage).toBe("pt");
  });

  test.each(languages.namespaces)("namespace %s tem exactamente as mesmas chaves nos 4 idiomas", (ns) => {
    const reference = leafKeys((RESOURCES.pt as Record<string, unknown>)[ns]).sort();
    expect(reference.length).toBeGreaterThan(0);
    for (const code of codes) {
      const keys = leafKeys((RESOURCES[code as LanguageCode] as Record<string, unknown>)[ns]).sort();
      expect(keys, `idioma ${code}`).toEqual(reference);
    }
  });

  test("nenhum texto está vazio", () => {
    for (const code of codes) {
      for (const value of leafValues(RESOURCES[code as LanguageCode])) {
        expect(value.trim().length, `idioma ${code}`).toBeGreaterThan(0);
      }
    }
  });

  test("os marcadores {nome} coincidem entre idiomas", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const ref = (RESOURCES.pt as { dashboard: { greeting: string } }).dashboard.greeting;
    for (const code of codes) {
      const text = (RESOURCES[code as LanguageCode] as { dashboard: { greeting: string } }).dashboard.greeting;
      expect(placeholders(text), `idioma ${code}`).toBe(placeholders(ref));
    }
  });

  test("todos os códigos de erro do servidor têm tradução em todos os idiomas", () => {
    const serverCodes = ["required", "invalid", "invalidEmail", "passwordTooShort", "tooLong", "invalidCountry", "mustAccept"];
    for (const code of codes) {
      for (const c of serverCodes) {
        expect(translate(code as LanguageCode, `auth.errors.${c}`)).not.toBe(`auth.errors.${c}`);
      }
    }
  });

  test("translate substitui parâmetros e devolve a chave quando falta", () => {
    expect(translate("en", "dashboard.greeting", { name: "Ana" })).toBe("Hello, Ana");
    expect(translate("pt", "dashboard.greeting", { name: "Ana" })).toBe("Olá, Ana");
    expect(translate("fr", "nao.existe")).toBe("nao.existe");
  });
});
