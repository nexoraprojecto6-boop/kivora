import {
  API_VERSION_PREFIX,
  type AdminDepositDto,
  type AdminSubscriptionDto,
  type AdminSummaryDto,
  type AdminTicketDetailDto,
  type AdminTicketDto,
  type AdminUserDetailDto,
  type AdminUserDto,
  type AdminVerificationDto,
  type AdminWithdrawalDto,
  type AgreementDto,
  type ApiErrorCode,
  type ApiFieldError,
  type AuditEventDto,
  type PaymentMethodDto,
  type PlanDto,
  type PublicUser,
  type VerificationFileKind,
} from "@kivora/shared";

export type ClientErrorCode = ApiErrorCode | "NETWORK";

/** Erro devolvido pela API (ou falha de rede). `message` nunca é texto para o utilizador. */
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

const BASE_URL = ((import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "").trim().replace(/\/+$/, "");

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function send(path: string, method: Method, body?: unknown): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${API_VERSION_PREFIX}${path}`, {
      method,
      credentials: "include",
      ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError("NETWORK", 0);
  }
}

async function request<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const res = await send(path, method, body);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* corpo vazio ou não JSON */
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

const qs = (p: Record<string, string | number | undefined | null>): string => {
  const e = Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return e.length ? `?${new URLSearchParams(e.map(([k, v]) => [k, String(v)])).toString()}` : "";
};
const enc = encodeURIComponent;

/** Ficheiro binário (comprovativo, documento de identidade). Devolve null se não existir. */
async function fetchBlob(path: string): Promise<{ url: string; mime: string } | null> {
  const res = await send(path, "GET");
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status === 403 ? "FORBIDDEN" : res.status === 401 ? "UNAUTHENTICATED" : "INTERNAL_ERROR", res.status);
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), mime: blob.type || res.headers.get("content-type") || "application/octet-stream" };
}

/* ---------- Autenticação ---------- */

export const authApi = {
  me: async (): Promise<PublicUser> => (await request<{ user: PublicUser }>("/auth/me", "GET")).user,
  login: async (input: { email: string; password: string }): Promise<PublicUser> =>
    (await request<{ user: PublicUser }>("/auth/login", "POST", input)).user,
  logout: async (): Promise<void> => {
    await request<unknown>("/auth/logout", "POST", {});
  },
};

/* ---------- Tipos de formulário ---------- */

export type PlanInput = Omit<PlanDto, "id" | "committedMinor">;
export type MethodInput = Omit<PaymentMethodDto, "id">;
export type UserStatus = "ACTIVE" | "LIMITED" | "SUSPENDED";
export type AgreementRow = Omit<AgreementDto, "acceptedAt"> & { acceptances: number };

/** Plano como o admin o vê: o servidor pode (ainda) não enviar a imagem. */
export type AdminPlan = PlanDto & { imageUrl?: string | null };

/* ---------- Administração ---------- */

export const adminApi = {
  summary: () => request<AdminSummaryDto>("/admin/summary", "GET"),

  /** Apenas ADMIN responde (SUPPORT recebe 403). Serve para saber o papel sem alterar o servidor. */
  probeAdmin: async (): Promise<boolean> => {
    try {
      await request<unknown>("/admin/audit?limit=1", "GET");
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) return false;
      throw e;
    }
  },

  /* Utilizadores */
  users: (q?: string) => request<AdminUserDto[]>(`/admin/users${qs({ q, limit: 100 })}`, "GET"),
  user: (id: string) => request<AdminUserDetailDto>(`/admin/users/${enc(id)}`, "GET"),
  setUserStatus: (id: string, status: UserStatus) =>
    request<AdminUserDetailDto>(`/admin/users/${enc(id)}/status`, "PATCH", { status }),

  /* Depósitos */
  deposits: (status?: string) => request<AdminDepositDto[]>(`/admin/deposits${qs({ status })}`, "GET"),
  confirmDeposit: (id: string, note: string) => request<AdminDepositDto>(`/admin/deposits/${enc(id)}/confirm`, "POST", { note }),
  rejectDeposit: (id: string, note: string) => request<AdminDepositDto>(`/admin/deposits/${enc(id)}/reject`, "POST", { note }),
  /** Comprovativo do depósito. Rota PENDENTE no servidor (ver docs/BACKEND-PENDENTE.md); null = sem ficheiro. */
  depositProof: (id: string) => fetchBlob(`/admin/deposits/${enc(id)}/proof`),

  /* Levantamentos */
  withdrawals: (status?: string) => request<AdminWithdrawalDto[]>(`/admin/withdrawals${qs({ status })}`, "GET"),
  approveWithdrawal: (id: string, note: string) => request<AdminWithdrawalDto>(`/admin/withdrawals/${enc(id)}/approve`, "POST", { note }),
  payWithdrawal: (id: string, note: string) => request<AdminWithdrawalDto>(`/admin/withdrawals/${enc(id)}/paid`, "POST", { note }),
  rejectWithdrawal: (id: string, note: string) => request<AdminWithdrawalDto>(`/admin/withdrawals/${enc(id)}/reject`, "POST", { note }),

  /* Verificação de identidade */
  verifications: (status?: string) => request<AdminVerificationDto[]>(`/admin/verifications${qs({ status })}`, "GET"),
  verificationFile: (id: string, kind: VerificationFileKind) => fetchBlob(`/admin/verifications/${enc(id)}/files/${kind}`),
  approveVerification: (id: string) => request<AdminVerificationDto>(`/admin/verifications/${enc(id)}/approve`, "POST", {}),
  rejectVerification: (id: string, note: string) => request<AdminVerificationDto>(`/admin/verifications/${enc(id)}/reject`, "POST", { note }),

  /* Planos */
  plans: () => request<AdminPlan[]>("/admin/plans", "GET"),
  createPlan: (input: PlanInput) => request<AdminPlan>("/admin/plans", "POST", input),
  updatePlan: (id: string, input: PlanInput) => request<AdminPlan>(`/admin/plans/${enc(id)}`, "PUT", input),
  /** Rota PENDENTE no servidor (ver docs/BACKEND-PENDENTE.md). */
  uploadPlanImage: (id: string, image: { mime: "image/jpeg" | "image/png" | "image/webp"; dataBase64: string }) =>
    request<AdminPlan>(`/admin/plans/${enc(id)}/image`, "POST", image),
  removePlanImage: (id: string) => request<AdminPlan>(`/admin/plans/${enc(id)}/image`, "DELETE"),

  /* Subscrições e rendimentos */
  subscriptions: (status?: string) => request<AdminSubscriptionDto[]>(`/admin/subscriptions${qs({ status })}`, "GET"),
  approveSubscription: (id: string, note: string) => request<AdminSubscriptionDto>(`/admin/subscriptions/${enc(id)}/approve`, "POST", { note }),
  rejectSubscription: (id: string, note: string) => request<AdminSubscriptionDto>(`/admin/subscriptions/${enc(id)}/reject`, "POST", { note }),
  /** Rotas PENDENTES no servidor (ver docs/BACKEND-PENDENTE.md). O servidor faz o lançamento no livro-razão. */
  applyYield: (subscriptionId: string, input: { amountMinor: number; note: string }) =>
    request<unknown>(`/admin/subscriptions/${enc(subscriptionId)}/yield`, "POST", input),
  applyPlanYield: (planId: string, input: { percentBp: number; note: string }) =>
    request<{ applied: number; totalMinor: number }>(`/admin/plans/${enc(planId)}/yield`, "POST", input),

  /* Métodos de pagamento */
  methods: () => request<PaymentMethodDto[]>("/admin/payment-methods", "GET"),
  createMethod: (input: MethodInput) => request<PaymentMethodDto>("/admin/payment-methods", "POST", input),
  updateMethod: (id: string, input: MethodInput) => request<PaymentMethodDto>(`/admin/payment-methods/${enc(id)}`, "PUT", input),

  /* Suporte */
  tickets: (status?: string) => request<AdminTicketDto[]>(`/admin/support/tickets${qs({ status })}`, "GET"),
  ticket: (id: string) => request<AdminTicketDetailDto>(`/admin/support/tickets/${enc(id)}`, "GET"),
  replyTicket: (id: string, message: string) => request<AdminTicketDetailDto>(`/admin/support/tickets/${enc(id)}/messages`, "POST", { message }),
  closeTicket: (id: string) => request<AdminTicketDetailDto>(`/admin/support/tickets/${enc(id)}/close`, "POST", {}),

  /* Acordos e auditoria */
  agreements: () => request<AgreementRow[]>("/admin/agreements", "GET"),
  publishAgreement: (input: { code: string; title: string; body: string }) =>
    request<{ versionId: string; version: number }>("/admin/agreements", "POST", input),
  audit: (limit = 100) => request<AuditEventDto[]>(`/admin/audit${qs({ limit })}`, "GET"),
};
