import { toFieldErrors } from "@kivora/validation";
import type { ZodError } from "zod";
import type { ApiFieldError } from "@kivora/shared";
import { ApiError } from "../../services/api-client.js";

export type FieldErrorMap = Record<string, string>;

/** Converte erros por campo (do cliente ou da API) num mapa campo → código. */
export function toErrorMap(errors: readonly ApiFieldError[]): FieldErrorMap {
  const map: FieldErrorMap = {};
  for (const e of errors) if (!(e.field in map)) map[e.field] = e.code;
  return map;
}

export function zodToErrorMap(error: ZodError): FieldErrorMap {
  return toErrorMap(toFieldErrors(error));
}

/** Chave de tradução para o erro de um campo. */
export function fieldErrorKey(code: string): string {
  return `auth.errors.${code}`;
}

/** Chave de tradução para um erro geral da API, consoante o contexto. */
export function formErrorKey(error: unknown, context: "login" | "register"): string {
  if (!(error instanceof ApiError)) return "auth.errors.generic";
  switch (error.code) {
    case "NETWORK":
      return "auth.errors.network";
    case "RATE_LIMITED":
      return "auth.errors.tooManyAttempts";
    case "UNAUTHENTICATED":
      return "auth.errors.invalidCredentials";
    case "CONFLICT":
      return context === "register" ? "auth.errors.emailInUse" : "auth.errors.generic";
    case "FEATURE_DISABLED":
      return "auth.errors.registrationUnavailable";
    default:
      return "auth.errors.generic";
  }
}
