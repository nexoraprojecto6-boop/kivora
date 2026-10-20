import { Controller, Get, Inject, Req } from "@nestjs/common";
import { API_ERROR_CODE, type ApiSuccessResponse } from "@kivora/shared";
import type { Request } from "express";
import { ApiException } from "../common/api-error.js";
import type { AppConfig } from "../config/env.js";
import { APP_CONFIG } from "../config/tokens.js";

export interface ClientIpDiagnostic {
  /** IP que a API considera ser o do cliente, com a configuração actual de proxies. */
  ip: string | null;
  forwardedFor: string | null;
  trustProxyHops: number;
}

/**
 * Serve só para acertar TRUST_PROXY_HOPS atrás do Render e da Vercel: mostra ao
 * próprio visitante o IP que a API vê. Desligado por defeito (responde 404).
 * Depois de configurar, desligar ENABLE_DIAGNOSTICS.
 */
@Controller("diagnostics")
export class DiagnosticsController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get("client-ip")
  clientIp(@Req() req: Request): ApiSuccessResponse<ClientIpDiagnostic> {
    if (!this.config.enableDiagnostics) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    return {
      data: {
        ip: req.ip ?? null,
        forwardedFor: req.header("x-forwarded-for") ?? null,
        trustProxyHops: this.config.trustProxyHops,
      },
    };
  }
}
