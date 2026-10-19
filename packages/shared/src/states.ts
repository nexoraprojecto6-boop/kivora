/**
 * Estados e transições permitidas dos processos da KIVORA.
 *
 * As transições são uma PROPOSTA, a validar com o modelo financeiro e os
 * contratos aprovados. A autoridade final sobre qualquer mudança de estado
 * é sempre o backend.
 *
 * Aprovação administrativa de um levantamento NÃO é pagamento concluído.
 */

/* ------------------------------ Verificação ------------------------------ */

export const VERIFICATION_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type VerificationStatus =
  (typeof VERIFICATION_STATUS)[keyof typeof VERIFICATION_STATUS];

export const VERIFICATION_TRANSITIONS: Readonly<
  Record<VerificationStatus, readonly VerificationStatus[]>
> = {
  draft: ["pending"],
  pending: ["in_review"],
  in_review: ["approved", "rejected"],
  approved: [],
  // Reenvio controlado: uma submissão rejeitada volta a rascunho.
  rejected: ["draft"],
};

/* -------------------------------- Depósito ------------------------------- */

export const DEPOSIT_STATUS = {
  CREATED: "created",
  PENDING: "pending",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export type DepositStatus =
  (typeof DEPOSIT_STATUS)[keyof typeof DEPOSIT_STATUS];

export const DEPOSIT_TRANSITIONS: Readonly<
  Record<DepositStatus, readonly DepositStatus[]>
> = {
  created: ["pending", "cancelled"],
  pending: ["confirmed", "rejected", "expired", "cancelled"],
  confirmed: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

/* ------------------------------ Levantamento ----------------------------- */

export const WITHDRAWAL_STATUS = {
  REQUESTED: "requested",
  IN_REVIEW: "in_review",
  APPROVED_FOR_PROCESSING: "approved_for_processing",
  PROCESSED: "processed",
  FAILED: "failed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export type WithdrawalStatus =
  (typeof WITHDRAWAL_STATUS)[keyof typeof WITHDRAWAL_STATUS];

export const WITHDRAWAL_TRANSITIONS: Readonly<
  Record<WithdrawalStatus, readonly WithdrawalStatus[]>
> = {
  requested: ["in_review", "rejected", "cancelled"],
  in_review: ["approved_for_processing", "rejected", "cancelled"],
  approved_for_processing: ["processed", "failed"],
  processed: [],
  // O tratamento de falhas (nova tentativa ou libertação da reserva)
  // depende de regras ainda por aprovar.
  failed: [],
  rejected: [],
  cancelled: [],
};

/* ---------------------------- Conta de utilizador ------------------------ */

export const USER_ACCOUNT_STATUS = {
  ACTIVE: "active",
  LIMITED: "limited",
  SUSPENDED: "suspended",
} as const;

export type UserAccountStatus =
  (typeof USER_ACCOUNT_STATUS)[keyof typeof USER_ACCOUNT_STATUS];

export const USER_ACCOUNT_TRANSITIONS: Readonly<
  Record<UserAccountStatus, readonly UserAccountStatus[]>
> = {
  active: ["limited", "suspended"],
  limited: ["active", "suspended"],
  suspended: ["active"],
};

/* --------------------------------- Auxiliar ------------------------------- */

/** Indica se a transição de `from` para `to` é permitida pela tabela dada. */
export function canTransition<S extends string>(
  transitions: Readonly<Record<S, readonly S[]>>,
  from: S,
  to: S,
): boolean {
  return transitions[from].includes(to);
}
