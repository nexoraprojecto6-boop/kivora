import { Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { ApiSuccessResponse } from "@kivora/shared";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { SESSION_COOKIE_NAME } from "../auth/session.service.js";
import { userIdOf } from "./http.js";
import { RealtimeService } from "./realtime.service.js";

/** Bilhete de ligação ao WebSocket: uso único, 30 s, ligado à sessão actual. */
@Controller("realtime")
@UseGuards(AuthGuard)
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Post("ticket")
  @HttpCode(200)
  async ticket(@Req() req: AuthenticatedRequest): Promise<ApiSuccessResponse<{ ticket: string; expiresInSeconds: number }>> {
    const token = String((req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE_NAME] ?? "");
    return { data: await this.realtime.issueTicket(userIdOf(req), token) };
  }
}
