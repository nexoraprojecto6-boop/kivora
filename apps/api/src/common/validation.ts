import type { ZodType } from "zod";
import { API_ERROR_CODE } from "@kivora/shared";
import { toFieldErrors } from "@kivora/validation";
import { ApiException } from "./api-error.js";

/** Valida dados de entrada no servidor. Em caso de erro lança VALIDATION_ERROR com códigos por campo. */
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiException(API_ERROR_CODE.VALIDATION_ERROR, {
      fieldErrors: toFieldErrors(result.error),
    });
  }
  return result.data;
}
