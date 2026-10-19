import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { API_ERROR_CODE, type ApiErrorCode } from "@kivora/shared";
import type { Response } from "express";
import { ApiException, sendApiError, codeForStatus } from "./api-error.js";

/**
 * Filtro global: toda a resposta de erro segue o contrato partilhado e nunca
 * expõe mensagens internas, rastos de pilha ou dados de outros utilizadores.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Errors");

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiException) {
      if (exception.retryAfterSeconds !== undefined) {
        res.setHeader("Retry-After", String(exception.retryAfterSeconds));
      }
      sendApiError(res, exception.code, exception.fieldErrors);
      return;
    }

    if (exception instanceof HttpException) {
      const code: ApiErrorCode = codeForStatus(exception.getStatus());
      if (code === API_ERROR_CODE.INTERNAL_ERROR) {
        this.logUnexpected(res, exception);
      }
      sendApiError(res, code);
      return;
    }

    this.logUnexpected(res, exception);
    sendApiError(res, API_ERROR_CODE.INTERNAL_ERROR);
  }

  private logUnexpected(res: Response, exception: unknown): void {
    const requestId = (res.locals["requestId"] as string | undefined) ?? "unknown";
    const detail = exception instanceof Error ? (exception.stack ?? exception.name) : "non-error thrown";
    // Só no registo do servidor, nunca na resposta.
    this.logger.error(`requestId=${requestId} ${detail}`);
  }
}
