/**
 * Tipos partilhados entre a API e as aplicações (web e admin) para os módulos operacionais.
 * Montantes: inteiros na menor unidade da moeda (decisão 7: provisório). Nenhum valor comercial é fixo no código.
 */
export type RequestStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
export type WithdrawalRequestStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "REJECTED" | "CANCELLED" | "COMPLETED";
export type RateMode = "FIXED" | "MARKET";
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
  /** Imagem grande do plano (servida pela API). Null = sem imagem. */
  imageUrl: string | null;
  /** Como funciona o plano e riscos, em texto definido pela administração. */
  howItWorks: string;
  riskDetails: string;
  /** FIXED: taxa sempre igual à normal. MARKET: a taxa segue o mercado entre o mínimo e o limite. */
  rateMode: RateMode;
  /** Símbolo do mercado de referência (ex.: EURUSD=X, AAPL, ^GSPC) e o nome mostrado ao cliente. */
  marketSymbol: string | null;
  marketLabel: string;
  /** Taxas diárias em pontos base por dia (100 = 1 % ao dia): normal, mínima (mercado em queda) e limite (mercado em alta). */
  baseRateBps: number;
  minRateBps: number;
  maxRateBps: number;
  /** Pontos base por dia que a taxa muda por cada 1 % de variação do mercado. */
  sensitivityBpsPerPct: number;
  /** De quantos em quantos dias a comissão pode ser levantada para a carteira. */
  payoutIntervalDays: number;
  /** Multiplicador da taxa quando há um convidado com plano activo (x100: 200 = dobra). */
  inviteBoostX100: number;
  autoActivate: boolean;
  /** Taxa em vigor agora (pontos base por dia, sem bónus de convite) e variação do mercado. Null se ainda não há dados. */
  currentRateBps: number | null;
  currentChangePct: number | null;
}

/** Campos que a administração escreve ao criar/editar um plano. */
export type PlanConfigInput = Omit<PlanDto, "id" | "committedMinor" | "imageUrl" | "currentRateBps" | "currentChangePct">;

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
  /** Início e fim da vida do plano (só depois de activo). */
  startsAt: string | null;
  endsAt: string | null;
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

/* ---------- Painel do plano (tudo calculado no servidor; o frontend só mostra) ---------- */
export interface MarketPointDto {
  /** Instante ISO e preço do mercado. */
  t: string;
  price: number;
}
export interface PlanMarketDto {
  symbol: string;
  label: string;
  price: number | null;
  /** Variação face ao fecho anterior, em %. */
  changePct: number | null;
  asOf: string | null;
  /** Sem dados recentes: o plano usa a taxa normal até o mercado voltar. */
  stale: boolean;
  /** Pontos novos desde o pedido anterior (ou os mais recentes, no primeiro pedido). */
  points: MarketPointDto[];
}
export interface PlanRateDto {
  mode: RateMode;
  baseBps: number;
  minBps: number;
  maxBps: number;
  sensitivityBpsPerPct: number;
  /** Taxa em vigor (sem bónus), multiplicador de convite (x100) e taxa efectiva. Pontos base por dia. */
  currentBps: number;
  boostX100: number;
  effectiveBps: number;
  /** Se a taxa está no mínimo ou no limite definido pela administração. */
  limit: "MIN" | "MAX" | null;
}
export interface PlanEarningsDto {
  currency: string;
  /** Comissão total gerada até agora (pode ter fracções da menor unidade). */
  generatedMinor: number;
  /** Já enviada para a carteira / disponível para enviar (inteiros). */
  claimedMinor: number;
  claimableMinor: number;
  /** Projecção à taxa efectiva de agora. */
  perMinuteMinor: number;
  perHourMinor: number;
  perDayMinor: number;
  /** Gerado no último minuto, hora e 24 horas. */
  lastMinuteMinor: number;
  lastHourMinor: number;
  lastDayMinor: number;
}
export interface PlanPayoutStateDto {
  intervalDays: number;
  /** Quando pode levantar de novo. Null = já pode (ou plano sem comissão). */
  nextClaimAt: string | null;
  canClaim: boolean;
  destination: "WALLET";
}
export interface SubscriptionLiveDto {
  status: SubscriptionStatus;
  rate: PlanRateDto;
  market: PlanMarketDto | null;
  earnings: PlanEarningsDto;
  payout: PlanPayoutStateDto;
  /** Segundos até o plano terminar. Null se sem prazo ou ainda não activo. */
  remainingSeconds: number | null;
  serverTime: string;
}
export interface PlanPayoutDto {
  id: string;
  amountMinor: number;
  kind: "CLAIM" | "EXPIRY";
  createdAt: string;
}
export interface SubscriptionPanelDto {
  subscription: SubscriptionDto;
  plan: PlanDto;
  boost: { qualifiedInvitees: number; multiplierX100: number; active: boolean };
  payouts: PlanPayoutDto[];
  live: SubscriptionLiveDto;
}
export type SeriesBucket = "minute" | "hour" | "day";
export interface EarningsSeriesDto {
  bucket: SeriesBucket;
  currency: string;
  points: { t: string; amountMinor: number }[];
}
export interface AdminPlanStatsDto {
  activeSubscriptions: number;
  principalMinor: number;
  /** Comissão gerada e ainda não levantada pelos clientes (responsabilidade da plataforma). */
  unclaimedMinor: number;
  claimedMinor: number;
  currentRateBps: number | null;
  currentChangePct: number | null;
  marketStale: boolean;
}
