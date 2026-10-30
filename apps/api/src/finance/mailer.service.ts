import { Injectable, Logger } from "@nestjs/common";
import { API_ERROR_CODE } from "@kivora/shared";
import { ApiException } from "../common/api-error.js";

/**
 * Envio de email transaccional através da API do Resend (sem dependências extra).
 * Variáveis: RESEND_API_KEY e MAIL_FROM (por exemplo "Kivora <no-reply@o-seu-dominio.com>").
 * Sem RESEND_API_KEY: em desenvolvimento o conteúdo vai para o log; em produção o envio falha.
 */
@Injectable()
export class Mailer {
  private readonly log = new Logger("Mailer");

  async send(to: string, subject: string, text: string): Promise<void> {
    const key = process.env["RESEND_API_KEY"]?.trim();
    const from = process.env["MAIL_FROM"]?.trim();
    if (!key || !from) {
      if (process.env["NODE_ENV"] === "production") {
        this.log.error("RESEND_API_KEY / MAIL_FROM não configurados: email não enviado.");
        throw new ApiException(API_ERROR_CODE.SERVICE_UNAVAILABLE);
      }
      this.log.warn(`[DEV] Email para ${to} | ${subject}\n${text}`);
      return;
    }
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      this.log.error("Falha de rede ao contactar o serviço de email.");
      throw new ApiException(API_ERROR_CODE.SERVICE_UNAVAILABLE);
    }
    if (!res.ok) {
      this.log.error(`O serviço de email respondeu ${res.status}.`);
      throw new ApiException(API_ERROR_CODE.SERVICE_UNAVAILABLE);
    }
  }
}
