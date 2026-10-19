import { API_ERROR_CODE } from "@kivora/shared";
import type { NextFunction, Request, Response } from "express";
import { sendApiError } from "./api-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defesa contra CSRF: pedidos que alteram estado e trazem um cabeçalho Origin
 * só passam se a origem estiver na lista permitida. Clientes sem Origin
 * (ferramentas de linha de comandos) não são afectados, porque o CSRF depende
 * de um navegador, que envia sempre Origin em pedidos de outra origem.
 */
export function originCheckMiddleware(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.header("origin");
    if (origin !== undefined && !allowed.has(origin)) {
      sendApiError(res, API_ERROR_CODE.FORBIDDEN);
      return;
    }
    next();
  };
}
