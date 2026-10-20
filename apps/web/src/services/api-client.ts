import {
  API_VERSION_PREFIX,
  type ApiErrorCode,
  type ApiFieldError,
  type PublicUser,
} from "@kivora/shared";
import type { LoginInput, RegisterInput } from "@kivora/validation";

export type ClientErrorCode = ApiErrorCode | "NETWORK";

/** Erro devolvido pela API (ou falha de rede). Nunca contém texto para mostrar ao utilizador. */
export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
    readonly fieldErrors: readonly ApiFieldError[] = [],
    readonly requestId?: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

const BASE_URL: string =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:3000";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${API_VERSION_PREFIX}${path}`, {
      method,
      credentials: "include",
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new ApiError("NETWORK", 0);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // corpo vazio ou não JSON
  }

  if (!res.ok) {
    const err = isRecord(json) && isRecord(json["error"]) ? json["error"] : undefined;
    const code = (typeof err?.["code"] === "string" ? err["code"] : "INTERNAL_ERROR") as ApiErrorCode;
    const fieldErrors = Array.isArray(err?.["fieldErrors"]) ? (err["fieldErrors"] as ApiFieldError[]) : [];
    const requestId = typeof err?.["requestId"] === "string" ? err["requestId"] : undefined;
    throw new ApiError(code, res.status, fieldErrors, requestId);
  }
  if (!isRecord(json) || !("data" in json)) throw new ApiError("INTERNAL_ERROR", res.status);
  return json["data"] as T;
}

export const authApi = {
  me: async (): Promise<PublicUser> => (await request<{ user: PublicUser }>("/auth/me", "GET")).user,
  login: async (input: LoginInput): Promise<PublicUser> =>
    (await request<{ user: PublicUser }>("/auth/login", "POST", input)).user,
  register: async (input: RegisterInput): Promise<PublicUser> =>
    (await request<{ user: PublicUser }>("/auth/register", "POST", input)).user,
  logout: async (): Promise<void> => {
    await request<{ loggedOut: true }>("/auth/logout", "POST", {});
  },
};
