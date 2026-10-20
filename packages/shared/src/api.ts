/**
 * Contrato comum da API KIVORA.
 * Ver docs/api/api-conventions.md.
 *
 * O frontend usa `code` para traduzir mensagens. O campo `message` é técnico
 * e não se mostra ao utilizador.
 */

export const API_VERSION_PREFIX = "/v1";

export const API_HEADERS = {
  IDEMPOTENCY_KEY: "Idempotency-Key",
  REQUEST_ID: "X-Request-Id",
} as const;

export const API_ERROR_CODE = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  FEATURE_DISABLED: "FEATURE_DISABLED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

/** Estado HTTP associado a cada código de erro. */
export const API_ERROR_HTTP_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE_TRANSITION: 409,
  IDEMPOTENCY_CONFLICT: 409,
  RATE_LIMITED: 429,
  FEATURE_DISABLED: 403,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** Erro de um campo concreto de um formulário ou pedido. */
export interface ApiFieldError {
  /** Nome do campo, por exemplo "email". */
  field: string;
  /** Código estável do erro, por exemplo "required" ou "invalidEmail". */
  code: string;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  /** Texto técnico, não destinado ao utilizador final. */
  message: string;
  requestId: string;
  fieldErrors?: readonly ApiFieldError[];
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export interface ApiSuccessResponse<T> {
  data: T;
}

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export interface PageInfo {
  /** Cursor da página seguinte, ou null se não houver mais resultados. */
  nextCursor: string | null;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: readonly T[];
  page: PageInfo;
}
