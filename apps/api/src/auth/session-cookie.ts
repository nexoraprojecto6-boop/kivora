import type { CookieOptions } from "express";
import type { AppConfig } from "../config/env.js";

/** Opções do cookie de sessão: HttpOnly sempre; Secure em produção; SameSite=Lax. */
export function sessionCookieOptions(config: AppConfig, expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
