import type { ApiErrorCode } from "@kivora/shared";
import type { ClientErrorCode } from "./api.js";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const STATUS_LABEL: Record<string, { text: string; tone: Tone }> = {
  PENDING: { text: "Pendente", tone: "warning" },
  CONFIRMED: { text: "Confirmado", tone: "success" },
  APPROVED: { text: "Aprovado", tone: "success" },
  ACTIVE: { text: "Activo", tone: "success" },
  PAID: { text: "Pago", tone: "success" },
  REJECTED: { text: "Rejeitado", tone: "danger" },
  CANCELLED: { text: "Cancelado", tone: "neutral" },
  LIMITED: { text: "Limitado", tone: "warning" },
  SUSPENDED: { text: "Banido", tone: "danger" },
  DRAFT: { text: "Rascunho", tone: "neutral" },
  COMING_SOON: { text: "Em breve", tone: "info" },
  OPEN: { text: "Aberto", tone: "success" },
  CLOSED: { text: "Fechado", tone: "neutral" },
  ANSWERED: { text: "Respondido", tone: "info" },
  NONE: { text: "Sem verificação", tone: "neutral" },
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  ID_CARD: "Bilhete de identidade",
  PASSPORT: "Passaporte",
  RESIDENCE_PERMIT: "Título de residência",
};
export const FILE_KIND_LABEL: Record<string, string> = { FRONT: "Frente", BACK: "Verso", SELFIE: "Selfie" };
export const CATEGORY_LABEL: Record<string, string> = {
  ACCOUNT: "Conta",
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Levantamento",
  VERIFICATION: "Verificação",
  OTHER: "Outro",
};
export const ROLE_LABEL: Record<string, string> = { USER: "Cliente", SUPPORT: "Suporte", ADMIN: "Administrador" };

const ERROR_TEXT: Record<ClientErrorCode, string> = {
  VALIDATION_ERROR: "Dados inválidos. Verifique os campos.",
  UNAUTHENTICATED: "A sessão terminou. Entre novamente.",
  FORBIDDEN: "Não tem permissão para esta acção.",
  NOT_FOUND: "Não encontrado. Se for uma funcionalidade nova, o servidor ainda não a tem (ver docs/BACKEND-PENDENTE.md).",
  CONFLICT: "Conflito com os dados existentes.",
  INVALID_STATE_TRANSITION: "Este pedido já foi decidido ou mudou de estado. Actualize a lista.",
  IDEMPOTENCY_CONFLICT: "Pedido duplicado.",
  RATE_LIMITED: "Demasiados pedidos. Aguarde um momento.",
  FEATURE_DISABLED: "Funcionalidade desligada no servidor.",
  SERVICE_UNAVAILABLE: "Serviço indisponível. Tente novamente.",
  INTERNAL_ERROR: "Erro interno do servidor.",
  NETWORK: "Sem ligação ao servidor.",
};

export function errorText(code: ClientErrorCode | ApiErrorCode): string {
  return ERROR_TEXT[code] ?? ERROR_TEXT.INTERNAL_ERROR;
}
