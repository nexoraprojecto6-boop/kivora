import {
  API_VERSION_PREFIX,
  type AgreementDto,
  type ApiErrorCode,
  type ApiFieldError,
  type DepositDto,
  type NotificationDto,
  type PaymentMethodDto,
  type PlanDto,
  type PublicUser,
  type SessionSummary,
  type SubscriptionDto,
  type TicketDetailDto,
  type TicketDto,
  type TransactionDto,
  type VerificationDocType,
  type VerificationDto,
  type VerificationFileKind,
  type WalletDto,
  type WithdrawalDto,
} from "@kivora/shared";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "@kivora/validation";

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

/**
 * Endereço base da API.
 * - Se VITE_API_BASE_URL estiver definida, usa-a.
 * - Em produção, sem variável: vazio, isto é, o mesmo domínio da página. A Vercel reencaminha
 *   /v1/... para a API (ver apps/web/vercel.json), por isso o cookie de sessão fica no domínio da web.
 * - Em desenvolvimento, sem variável: a API local na porta 3000.
 */
export function resolveBaseUrl(configured: string | undefined, isProduction: boolean): string {
  const value = configured?.trim();
  if (value) return value.replace(/\/+$/, "");
  return isProduction ? "" : "http://localhost:3000";
}

const BASE_URL: string = resolveBaseUrl(
  import.meta.env["VITE_API_BASE_URL"] as string | undefined,
  import.meta.env.PROD,
);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function request<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${API_VERSION_PREFIX}${path}`, {
      method,
      credentials: "include",
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json", ...extraHeaders }, body: JSON.stringify(body) }
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
  /** Envia um código de 6 dígitos para o email da conta. Devolve true se o email já estava verificado. */
  sendEmailCode: async (): Promise<boolean> => (await request<{ alreadyVerified: boolean }>("/auth/email/send", "POST", {})).alreadyVerified,
  verifyEmailCode: (code: string) => request<{ verified: true }>("/auth/email/verify", "POST", { code }),
  login: async (input: LoginInput): Promise<PublicUser> =>
    (await request<{ user: PublicUser }>("/auth/login", "POST", input)).user,
  register: async (input: RegisterInput): Promise<PublicUser> =>
    (await request<{ user: PublicUser }>("/auth/register", "POST", input)).user,
  logout: async (): Promise<void> => {
    await request<{ loggedOut: true }>("/auth/logout", "POST", {});
  },
  sessions: async (): Promise<SessionSummary[]> =>
    (await request<{ sessions: SessionSummary[] }>("/auth/sessions", "GET")).sessions,
  revokeSession: async (id: string): Promise<void> => {
    await request<{ revoked: true }>(`/auth/sessions/${encodeURIComponent(id)}`, "DELETE");
  },
  revokeOtherSessions: async (): Promise<number> =>
    (await request<{ revokedSessions: number }>("/auth/sessions/revoke-others", "POST", {})).revokedSessions,
  changePassword: async (input: ChangePasswordInput): Promise<number> =>
    (await request<{ revokedSessions: number }>("/auth/change-password", "POST", input)).revokedSessions,
};

const qs = (p: Record<string, string | undefined>): string => {
  const e = Object.entries(p).filter((kv): kv is [string, string] => !!kv[1]);
  return e.length ? `?${new URLSearchParams(e).toString()}` : "";
};
const idem = (key: string): Record<string, string> => ({ "Idempotency-Key": key });

/** Módulos operacionais. Tudo vem do servidor; nada é calculado nem inventado aqui. */
export const platformApi = {
  wallet: () => request<WalletDto>("/wallet", "GET"),
  transactions: (p: { kind?: string; q?: string; cursor?: string }) =>
    request<{ items: TransactionDto[]; nextCursor: string | null }>(`/transactions${qs({ ...p, limit: "10" })}`, "GET"),
  methods: (kind: "DEPOSIT" | "WITHDRAWAL") => request<PaymentMethodDto[]>(`/payment-methods${qs({ kind })}`, "GET"),
  createDeposit: (input: { methodId: string; amountMinor: number; note?: string }, key: string) =>
    request<DepositDto>("/deposits", "POST", input, idem(key)),
  createWithdrawal: (input: { methodId: string; amountMinor: number; destination: string }, key: string) =>
    request<WithdrawalDto>("/withdrawals", "POST", input, idem(key)),
  cancel: (kind: "DEPOSIT" | "WITHDRAWAL" | "SUBSCRIPTION", id: string) =>
    request<unknown>(`/${kind === "DEPOSIT" ? "deposits" : kind === "WITHDRAWAL" ? "withdrawals" : "subscriptions"}/${encodeURIComponent(id)}/cancel`, "POST", {}),
  plans: () => request<PlanDto[]>("/plans", "GET"),
  plan: (id: string) => request<PlanDto>(`/plans/${encodeURIComponent(id)}`, "GET"),
  subscribe: (planId: string, amountMinor: number, key: string) =>
    request<SubscriptionDto>(`/plans/${encodeURIComponent(planId)}/subscriptions`, "POST", { amountMinor }, idem(key)),
  agreements: () => request<AgreementDto[]>("/agreements", "GET"),
  acceptAgreement: (versionId: string) => request<AgreementDto[]>(`/agreements/${encodeURIComponent(versionId)}/accept`, "POST", {}),
  verification: async () => (await request<{ submission: VerificationDto | null }>("/verification", "GET")).submission,
  submitVerification: (input: { docType: VerificationDocType; issuingCountry: string; files: { kind: VerificationFileKind; mime: string; dataBase64: string }[] }) =>
    request<{ submission: VerificationDto }>("/verification", "POST", input),
  notifications: () => request<{ items: NotificationDto[]; unread: number }>("/notifications", "GET"),
  readNotification: (id: string) => request<unknown>(`/notifications/${encodeURIComponent(id)}/read`, "POST", {}),
  readAllNotifications: () => request<unknown>("/notifications/read-all", "POST", {}),
  tickets: () => request<TicketDto[]>("/support/tickets", "GET"),
  ticket: (id: string) => request<TicketDetailDto>(`/support/tickets/${encodeURIComponent(id)}`, "GET"),
  createTicket: (input: { subject: string; category: string; message: string }) => request<TicketDetailDto>("/support/tickets", "POST", input),
  reply: (id: string, message: string) => request<TicketDetailDto>(`/support/tickets/${encodeURIComponent(id)}/messages`, "POST", { message }),
};
