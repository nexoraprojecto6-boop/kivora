import { HttpException } from "@nestjs/common";
import {
  API_ERROR_CODE,
  API_ERROR_HTTP_STATUS,
  API_HEADERS,
  type ApiErrorCode,
  type ApiErrorResponse,
  type ApiFieldError,
} from "@kivora/shared";
import type { Response } from "express";

/** Textos técnicos genéricos por código. Nunca incluem detalhes internos. */
const GENERIC_MESSAGE: Readonly<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR: "Invalid request.",
  UNAUTHENTICATED: "Authentication required.",
  FORBIDDEN: "Not allowed.",
  NOT_FOUND: "Resource not found.",
  CONFLICT: "Conflict with current state.",
  INVALID_STATE_TRANSITION: "Invalid state transition.",
  IDEMPOTENCY_CONFLICT: "Idempotency key already used with a different request.",
  RATE_LIMITED: "Too many requests.",
  FEATURE_DISABLED: "Feature disabled.",
  SERVICE_UNAVAILABLE: "Service unavailable.",
  INTERNAL_ERROR: "Internal error.",
};

/** Erro conhecido da aplicação, com código estável do contrato partilhado. */
export class ApiException extends HttpException {
  readonly code: ApiErrorCode;
  readonly fieldErrors: readonly ApiFieldError[] | undefined;

  constructor(code: ApiErrorCode, fieldErrors?: readonly ApiFieldError[]) {
    super(GENERIC_MESSAGE[code], API_ERROR_HTTP_STATUS[code]);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function buildErrorResponse(
  code: ApiErrorCode,
  requestId: string,
  fieldErrors?: readonly ApiFieldError[],
): ApiErrorResponse {
  return {
    error: {
      code,
      message: GENERIC_MESSAGE[code],
      requestId,
      ...(fieldErrors && fieldErrors.length > 0 ? { fieldErrors } : {}),
    },
  };
}

/** Envia um erro no formato uniforme (usado também fora do sistema de filtros do Nest). */
export function sendApiError(
  res: Response,
  code: ApiErrorCode,
  fieldErrors?: readonly ApiFieldError[],
): void {
  const requestId =
    (res.locals["requestId"] as string | undefined) ??
    res.getHeader(API_HEADERS.REQUEST_ID)?.toString() ??
    "unknown";
  res.status(API_ERROR_HTTP_STATUS[code]).json(buildErrorResponse(code, requestId, fieldErrors));
}

/** Converte um estado HTTP numa categoria do contrato. */
export function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return API_ERROR_CODE.UNAUTHENTICATED;
    case 403:
      return API_ERROR_CODE.FORBIDDEN;
    case 404:
      return API_ERROR_CODE.NOT_FOUND;
    case 409:
      return API_ERROR_CODE.CONFLICT;
    case 429:
      return API_ERROR_CODE.RATE_LIMITED;
    case 503:
      return API_ERROR_CODE.SERVICE_UNAVAILABLE;
    default:
      return status >= 400 && status < 500
        ? API_ERROR_CODE.VALIDATION_ERROR
        : API_ERROR_CODE.INTERNAL_ERROR;
  }
}
