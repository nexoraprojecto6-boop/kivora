/** Âmbitos que o cliente sabe refrescar. */
export const REALTIME_SCOPES = ["wallet", "deposits", "withdrawals", "subscriptions", "verification", "account", "referrals", "support", "notifications", "history"] as const;
export type RealtimeScope = (typeof REALTIME_SCOPES)[number];

/** Que listas mudam quando chega uma notificação deste tipo. */
export function scopesFor(type: string): RealtimeScope[] {
  const out: RealtimeScope[] = ["notifications"];
  if (type.startsWith("DEPOSIT")) out.push("deposits", "wallet", "history");
  else if (type.startsWith("WITHDRAWAL")) out.push("withdrawals", "wallet", "history");
  else if (type.startsWith("SUBSCRIPTION") || type.startsWith("PLAN") || type.startsWith("YIELD") || type.startsWith("EARNINGS")) out.push("subscriptions", "wallet", "history");
  else if (type.startsWith("VERIFICATION") || type.startsWith("KYC") || type.startsWith("EMAIL")) out.push("verification", "account");
  else if (type.startsWith("REFERRAL")) out.push("referrals", "wallet");
  else if (type.startsWith("TICKET") || type.startsWith("SUPPORT")) out.push("support");
  return out;
}

export function isScope(v: unknown): v is RealtimeScope {
  return typeof v === "string" && (REALTIME_SCOPES as readonly string[]).includes(v);
}
