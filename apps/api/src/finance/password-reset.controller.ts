import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { ApiSuccessResponse } from "@kivora/shared";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@kivora/validation";
import type { Request } from "express";
import { z } from "zod";
import { PasswordResetService } from "./password-reset.service.js";
import { body, requestIdOf } from "./http.js";

const emailField = z
  .string({ error: "required" })
  .trim()
  .toLowerCase()
  .min(1, { error: "required" })
  .max(254, { error: "tooLong" })
  .pipe(z.email({ error: "invalidEmail" }));

const forgotSchema = z.strictObject({ email: emailField });

const resetSchema = z.strictObject({
  email: emailField,
  code: z.string({ error: "required" }).trim().regex(/^\d{6}$/, { error: "invalidCode" }),
  newPassword: z
    .string({ error: "required" })
    .min(PASSWORD_MIN_LENGTH, { error: "passwordTooShort" })
    .max(PASSWORD_MAX_LENGTH, { error: "tooLong" }),
});

/** Recuperação de palavra-passe (sem sessão): pedir código por email e redefinir. */
@Controller("auth/password")
export class PasswordResetController {
  constructor(private readonly resets: PasswordResetService) {}

  @Post("forgot")
  @HttpCode(200)
  async forgot(@Req() req: Request, @Body() b: unknown): Promise<ApiSuccessResponse<{ sent: true }>> {
    await this.resets.send(body(forgotSchema, b).email, req.ip ?? "unknown", requestIdOf(req));
    return { data: { sent: true } };
  }

  @Post("reset")
  @HttpCode(200)
  async reset(@Req() req: Request, @Body() b: unknown): Promise<ApiSuccessResponse<{ reset: true }>> {
    const input = body(resetSchema, b);
    await this.resets.reset(input.email, input.code, input.newPassword, req.ip ?? "unknown", requestIdOf(req));
    return { data: { reset: true } };
  }
}
