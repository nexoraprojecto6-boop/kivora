import type { UserAccountStatus } from "./states.js";

/** Utilizador visível ao cliente. Nunca inclui credenciais. */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  countryOfResidence: string;
  status: UserAccountStatus;
  emailVerified: boolean;
}

/** Sessão aberta de um utilizador, como a vê o próprio. Nunca inclui o token nem o seu hash. */
export interface SessionSummary {
  id: string;
  /** ISO 8601, em UTC. */
  createdAt: string;
  expiresAt: string;
  /** Verdadeiro para a sessão que fez o pedido. */
  current: boolean;
}
