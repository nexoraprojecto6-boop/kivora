import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { ApiSuccessResponse } from "@kivora/shared";
import { z } from "zod";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { body, requestIdOf, userIdOf } from "./http.js";

const codeSchema = z.strictObject({ code: z.string({ error: "required" }).trim().regex(/^\d{6}$/, { error: "invalidCode" }) });

/** Verificação de email do próprio utilizador autenticado. */
@Controller("auth/email")
@UseGuards(AuthGuard)
export class EmailController {
  constructor(private readonly emails: EmailVerificationService) {}

  @Post("send")
  @HttpCode(200)
  async send(@Req() req: AuthenticatedRequest): Promise<ApiSuccessResponse<{ alreadyVerified: boolean }>> {
    return { data: await this.emails.send(userIdOf(req), requestIdOf(req)) };
  }

  @Post("verify")
  @HttpCode(200)
  async verify(@Req() req: AuthenticatedRequest, @Body() b: unknown): Promise<ApiSuccessResponse<{ verified: true }>> {
    await this.emails.verify(userIdOf(req), body(codeSchema, b).code, requestIdOf(req));
    return { data: { verified: true } };
  }
}
