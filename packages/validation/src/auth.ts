import { z } from "zod";
import type { ApiFieldError } from "@kivora/shared";

/**
 * Esquemas de autenticação partilhados entre o backend e as aplicações.
 * As mensagens de erro são CÓDIGOS estáveis (por exemplo "invalidEmail"),
 * que o frontend traduz através do sistema de internacionalização.
 * A validação no servidor é a que conta; a do cliente serve só a experiência de uso.
 *
 * Os campos do registo são provisórios (decisões 4 e 6 em docs/compliance).
 */

export const PASSWORD_MIN_LENGTH = 12;
/** Limite máximo para evitar abuso com palavras-passe gigantes. */
export const PASSWORD_MAX_LENGTH = 128;

const emailField = z
  .string({ error: "required" })
  .trim()
  .toLowerCase()
  .min(1, { error: "required" })
  .max(254, { error: "tooLong" })
  .pipe(z.email({ error: "invalidEmail" }));

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: "required" })
    .min(1, { error: "required" })
    .max(PASSWORD_MAX_LENGTH, { error: "tooLong" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z
    .string({ error: "required" })
    .trim()
    .min(2, { error: "required" })
    .max(120, { error: "tooLong" }),
  email: emailField,
  password: z
    .string({ error: "required" })
    .min(PASSWORD_MIN_LENGTH, { error: "passwordTooShort" })
    .max(PASSWORD_MAX_LENGTH, { error: "tooLong" }),
  /** Código ISO 3166-1 alfa-2. A lista de países suportados vem depois. */
  countryOfResidence: z
    .string({ error: "required" })
    .trim()
    .regex(/^[A-Za-z]{2}$/, { error: "invalidCountry" })
    .transform((v) => v.toUpperCase()),
  acceptTerms: z.literal(true, { error: "mustAccept" }),
  acceptPrivacy: z.literal(true, { error: "mustAccept" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Converte erros do zod em erros por campo do contrato da API. */
export function toFieldErrors(error: z.ZodError): ApiFieldError[] {
  const seen = new Set<string>();
  const out: ApiFieldError[] = [];
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "_";
    const code = issue.message && /^[A-Za-z][A-Za-z0-9]*$/.test(issue.message) ? issue.message : "invalid";
    const key = `${field}:${code}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ field, code });
    }
  }
  return out;
}

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "required" })
      .min(1, { error: "required" })
      .max(PASSWORD_MAX_LENGTH, { error: "tooLong" }),
    newPassword: z
      .string({ error: "required" })
      .min(PASSWORD_MIN_LENGTH, { error: "passwordTooShort" })
      .max(PASSWORD_MAX_LENGTH, { error: "tooLong" }),
  })
  .refine((d) => d.currentPassword !== d.newPassword, { path: ["newPassword"], error: "sameAsCurrent" });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
