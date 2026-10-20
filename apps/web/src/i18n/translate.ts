import { DEFAULT_LANGUAGE, RESOURCES, type LanguageCode } from "./resources.js";

/** Procura "namespace.chave.subchave" num idioma. Devolve undefined se não existir. */
function lookup(language: LanguageCode, key: string): string | undefined {
  const [namespace, ...path] = key.split(".");
  let node: unknown = (RESOURCES[language] as Record<string, unknown>)[namespace ?? ""];
  for (const part of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Traduz uma chave. Se faltar no idioma pedido, usa o português; se faltar também,
 * devolve a própria chave (para a falta ser visível). Substitui {nome} pelos parâmetros.
 */
export function translate(
  language: LanguageCode,
  key: string,
  params?: Record<string, string>,
): string {
  const text = lookup(language, key) ?? lookup(DEFAULT_LANGUAGE, key) ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}
