import type { PublicUser, UserAccountStatus } from "@kivora/shared";

export type { PublicUser };

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  countryOfResidence: string;
  status: UserAccountStatus;
  /** Verdadeiro só quando existir um mecanismo real de verificação (decisão 6). */
  emailVerified: boolean;
  createdAt: Date;
}

export interface NewUser {
  email: string;
  fullName: string;
  countryOfResidence: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  /** Guarda-se apenas o hash do token; o token em claro só existe no cookie do cliente. */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export type ConsentDocumentType = "terms" | "privacy";

export interface NewConsent {
  documentType: ConsentDocumentType;
  /** Versão do texto aceite. Enquanto os textos não existirem, usa-se um marcador. */
  documentVersion: string;
  acceptedAt: Date;
}

export interface AuditEventInput {
  action: string;
  actorUserId: string | null;
  requestId: string;
  outcome: "success" | "failure";
  /** Contexto mínimo. Nunca palavras-passe, tokens ou documentos. */
  metadata?: Record<string, string | number | boolean>;
}

export function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    countryOfResidence: u.countryOfResidence,
    status: u.status,
    emailVerified: u.emailVerified,
  };
}
