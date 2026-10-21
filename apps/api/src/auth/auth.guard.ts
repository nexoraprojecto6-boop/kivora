import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { API_ERROR_CODE } from "@kivora/shared";
import type { Request } from "express";
import { ApiException } from "../common/api-error.js";
import type { SessionRecord, UserRecord } from "./auth.types.js";
import { SESSION_COOKIE_NAME, SessionService } from "./session.service.js";

export interface AuthenticatedRequest extends Request {
  authUser?: UserRecord;
  authSession?: SessionRecord;
}

/** Protege rotas privadas. A autorização é sempre verificada no backend. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
    const resolved = await this.sessions.resolve(token);
    if (!resolved) throw new ApiException(API_ERROR_CODE.UNAUTHENTICATED);
    req.authUser = resolved.user;
    req.authSession = resolved.session;
    return true;
  }
}
