import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE } from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { one } from "./sql.js";

export const PG_POOL = Symbol("PG_POOL");
export const FINANCE_CONFIG = Symbol("FINANCE_CONFIG");

export interface FinanceConfig {
  /** Interruptor de segurança: operações financeiras só com FINANCE_ENABLED=true (decisão 1 em aberto). */
  enabled: boolean;
  /** Moeda única provisória (decisões 7 e 8). */
  currency: string;
  /** Exige verificação de identidade aprovada antes de operar. */
  requireKyc: boolean;
}

export function loadFinanceConfig(env: NodeJS.ProcessEnv = process.env): FinanceConfig {
  const currency = (env["PLATFORM_CURRENCY"] ?? "AOA").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("PLATFORM_CURRENCY inválida: use um código de 3 letras.");
  return {
    enabled: env["FINANCE_ENABLED"] === "true",
    currency,
    requireKyc: env["FINANCE_REQUIRE_KYC"] !== "false",
  };
}

/** Condições para qualquer operação que mexe em dinheiro. */
@Injectable()
export class FinanceGate {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(FINANCE_CONFIG) readonly config: FinanceConfig,
  ) {}

  async check(userId: string): Promise<void> {
    if (!this.config.enabled) throw new ApiException(API_ERROR_CODE.FEATURE_DISABLED);
    const user = await one<{ status: string }>(this.pool, "SELECT status FROM users WHERE id = $1", [userId]);
    if (user?.status !== "ACTIVE") throw new ApiException(API_ERROR_CODE.FORBIDDEN);
    if (this.config.requireKyc) {
      const ok = await one(this.pool, "SELECT 1 FROM verification_submissions WHERE user_id = $1 AND status = 'APPROVED' LIMIT 1", [userId]);
      if (!ok) throw new ApiException(API_ERROR_CODE.FORBIDDEN, { fieldErrors: [{ field: "verification", code: "required" }] });
    }
  }
}
