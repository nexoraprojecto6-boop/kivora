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
