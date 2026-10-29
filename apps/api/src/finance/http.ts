import { API_ERROR_CODE } from "@kivora/shared";
import type { Request } from "express";
import type { ZodType } from "zod";
import { ApiException } from "../common/api-error.js";
import { parseOrThrow } from "../common/validation.js";
import type { AuthenticatedRequest } from "../auth/auth.guard.js";
import { idSchema, idemKeySchema } from "./schemas.js";
import type { Ctx } from "./sql.js";

export const requestIdOf = (req: Request): string => (req.res?.locals["requestId"] as string | undefined) ?? "unknown";

export function userIdOf(req: AuthenticatedRequest): string {
  const id = req.authUser?.id;
  if (!id) throw new ApiException(API_ERROR_CODE.UNAUTHENTICATED);
  return id;
}

export const ctxOf = (req: AuthenticatedRequest): Ctx => ({ actorId: userIdOf(req), requestId: requestIdOf(req) });

/** Cabeçalho Idempotency-Key opcional. Se existir e for inválido, é um erro de validação. */
export function idemOf(req: Request): string | null {
  const raw = req.header("idempotency-key");
  return raw === undefined ? null : parseOrThrow(idemKeySchema, raw);
}

export const idOf = (value: unknown): string => parseOrThrow(idSchema, value);
export const body = <T>(schema: ZodType<T>, value: unknown): T => parseOrThrow(schema, value);

export function qStr(value: unknown, pattern = /^[\w .@+-]{1,80}$/): string | null {
  if (typeof value !== "string" || value === "") return null;
  if (!pattern.test(value)) throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR);
  return value;
}
export const qStatus = (value: unknown): string | null => qStr(value, /^[A-Z_]{3,20}$/);

export function qInt(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
