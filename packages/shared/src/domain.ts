/**
 * Tipos partilhados entre a API e as aplicações (web e admin) para os módulos operacionais.
 * Montantes: inteiros na menor unidade da moeda (decisão 7: provisório). Nenhum valor comercial é fixo no código.
 */
export type RequestStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
export type WithdrawalRequestStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "REJECTED" | "CANCELLED";
export type PlanStatus = "DRAFT" | "COMING_SOON" | "OPEN" | "CLOSED";
export type KycStatus = "PENDING" | "APPROVED" | "REJECTED";
export type VerificationDocType = "ID_CARD" | "PASSPORT" | "RESIDENCE_PERMIT";
export type VerificationFileKind = "FRONT" | "BACK" | "SELFIE";
export type TicketStatus = "OPEN" | "ANSWERED" | "CLOSED";
export type TicketCategory = "ACCOUNT" | "DEPOSIT" | "WITHDRAWAL" | "VERIFICATION" | "OTHER";
export type StaffRole = "USER" | "SUPPORT" | "ADMIN";
export type TransactionKind = "DEPOSIT" | "WITHDRAWAL" | "SUBSCRIPTION";

export interface WalletDto {
  currency: string;
  available: number;
  reserved: number;
  total: number;
  /** Falso enquanto o interruptor FINANCE_ENABLED estiver desligado no servidor (decisão 1). */
  financeEnabled: boolean;
  requireVerification: boolean;
  verificationStatus: KycStatus | "NONE";
}

export type PaymentRail = "PAYPAY" | "KWIK" | "EXPRESS" | "REFERENCIA";

export interface PaymentMethodDto {
  id: string;
  kind: "DEPOSIT" | "WITHDRAWAL";
  /** Serviço (PayPay, Kwik, Express, Referência). null = método antigo, sem serviço. */
  rail: PaymentRail | null;
  /** Dados da conta da plataforma. Só o administrador os vê na lista; o cliente recebe-os ao criar o depósito. */
  accountHolder: string;
  accountNumber: string;
  entity: string;
  reference: string;
  name: string;
  instructions: string;
  minMinor: number | null;
  maxMinor: number | null;
  feeMinor: number | null;
  feeNote: string;
  enabled: boolean;
  sortOrder: number;
}

export interface DepositDto {
  id: string;
  reference: string;
  amountMinor: number;
  currency: string;
  status: RequestStatus;
  userNote: string;
  decisionNote: string;
  createdAt: string;
  decidedAt: string | null;
  methodId: string;
  methodName: string;
  instructions: string;
  rail: PaymentRail | null;
  /** Para onde o cliente deve pagar. */
  payTo: { holder: string; number: string; entity: string; reference: string };
  /** Fim do prazo para enviar o comprovativo (1 hora). */
  expiresAt: string;
  txId: string;
  proofSubmitted: boolean;
}

export interface PaymentAccountDto {
  id: string;
  rail: Exclude<PaymentRail, "REFERENCIA">;
  holder: string;
  detail: string;
  createdAt: string;
}

export interface WithdrawalDto {
  id: string;
  reference: string;
  amountMinor: number;
  currency: string;
  status: WithdrawalRequestStatus;
  destination: string;
  decisionNote: string;
  createdAt: string;
  decidedAt: string | null;
  methodId: string;
  methodName: string;
}

export interface PlanDto {
  id: string;
  name: string;
  description: string;
  minMinor: number | null;
  maxMinor: number | null;
  capacityMinor: number | null;
  /** Soma dos pedidos pendentes e activos. Só existe quando há capacidade definida. */
  committedMinor: number | null;
  termDays: number | null;
  riskLabel: string;
  status: PlanStatus;
  sortOrder: number;
}

export interface SubscriptionDto {
  id: string;
  reference: string;
  planId: string;
  planName: string;
  amountMinor: number;
  currency: string;
  status: SubscriptionStatus;
  decisionNote: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface TransactionDto {
  id: string;
  kind: TransactionKind;
  amountMinor: number;
  status: string;
  reference: string;
  createdAt: string;
}

export interface AgreementDto {
  versionId: string;
  code: string;
  version: number;
  title: string;
  body: string;
  publishedAt: string;
  acceptedAt: string | null;
}

export interface VerificationDto {
  id: string;
  status: KycStatus;
  docType: VerificationDocType;
  issuingCountry: string;
  rejectionReason: string;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  params: Record<string, string | number>;
  read: boolean;
  createdAt: string;
}

export interface TicketDto {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessageDto {
  id: string;
  staff: boolean;
  body: string;
  createdAt: string;
}

export interface TicketDetailDto extends TicketDto {
  messages: TicketMessageDto[];
}

/* ---------- Administração ---------- */

export interface AdminSummaryDto {
  users: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  pendingSubscriptions: number;
  pendingVerifications: number;
  openTickets: number;
}

export interface AdminUserDto {
  id: string;
  email: string;
  fullName: string;
  countryOfResidence: string;
  status: "ACTIVE" | "LIMITED" | "SUSPENDED";
  role: StaffRole;
  createdAt: string;
  verificationStatus: KycStatus | "NONE";
}

export interface AdminUserDetailDto extends AdminUserDto {
  available: number;
  reserved: number;
  deposits: number;
  withdrawals: number;
  subscriptions: number;
}

export interface WithUser {
  userId: string;
  userEmail: string;
  userName: string;
}

export type AdminDepositDto = DepositDto & WithUser;
export type AdminWithdrawalDto = WithdrawalDto & WithUser;
export type AdminSubscriptionDto = SubscriptionDto & WithUser;
export type AdminVerificationDto = VerificationDto & WithUser & { files: VerificationFileKind[] };
export type AdminTicketDto = TicketDto & WithUser;
export interface AdminTicketDetailDto extends AdminTicketDto {
  messages: TicketMessageDto[];
}

export interface AuditEventDto {
  id: string;
  action: string;
  actorEmail: string | null;
  requestId: string;
  outcome: "SUCCESS" | "FAILURE";
  createdAt: string;
}

/* ---------- Convidar e ganhar (tudo calculado no servidor) ---------- */
export interface ReferralLevelDto {
  level: number;
  name: string;
  minFunded: number;
  /** Pontos base: 100 = 1 %. */
  yieldBonusBps: number;
}
export interface ReferralInviteDto {
  /** Identificador público curto do convidado (nunca o id interno, nome ou email). */
  memberCode: string;
  joinedAt: string;
  emailVerified: boolean;
  kycVerified: boolean;
  funded: boolean;
  subscribed: boolean;
  /** Retido pela administração para análise. */
  inReview: boolean;
  commissionMinor: number | null;
}
export interface ReferralSeriesPoint {
  date: string;
  /** Valores acumulados até esse dia. */
  registered: number;
  funded: number;
  subscribed: number;
}
export interface ReferralOverviewDto {
  enabled: boolean;
  code: string;
  /** Caminho de registo com o código, ex.: /register?ref=ABCD2345. */
  path: string;
  currency: string;
  totals: { registered: number; emailVerified: number; kycVerified: number; funded: number; subscribed: number; qualified: number; inReview: number };
  earnings: { paidMinor: number; pendingMinor: number; perInviteMinor: number };
  unlock: { required: number; funded: number; unlocked: boolean };
  level: { current: ReferralLevelDto | null; next: ReferralLevelDto | null; funded: number };
  levels: ReferralLevelDto[];
  series: ReferralSeriesPoint[];
  invites: ReferralInviteDto[];
}
export interface ReferralSettingsDto {
  enabled: boolean;
  commissionMinor: number;
  minFundedToUnlock: number;
  minDepositMinor: number;
  maxSameIp: number;
  levels: ReferralLevelDto[];
}
export interface AdminReferralDto {
  id: string;
  status: "ACTIVE" | "FLAGGED" | "REJECTED";
  createdAt: string;
  referrerId: string;
  referrerEmail: string;
  referredId: string;
  referredEmail: string;
}
