import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { ApiSuccessResponse } from "@kivora/shared";
import { loginSchema, registerSchema } from "@kivora/validation";
import type { Request, Response } from "express";
import { parseOrThrow } from "../common/validation.js";
import type { AppConfig } from "../config/env.js";
import { APP_CONFIG } from "../config/tokens.js";
import { AuthGuard, type AuthenticatedRequest } from "./auth.guard.js";
import { AuthService, type RequestContext } from "./auth.service.js";
import { toPublicUser, type PublicUser } from "./auth.types.js";
import { sessionCookieOptions } from "./session-cookie.js";
import { SESSION_COOKIE_NAME } from "./session.service.js";

function contextOf(req: Request, res: Response): RequestContext {
  return {
    ip: req.ip ?? "unknown",
    requestId: (res.locals["requestId"] as string | undefined) ?? "unknown",
  };
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post("register")
  @HttpCode(201)
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ user: PublicUser }>> {
    const input = parseOrThrow(registerSchema, body);
    const user = await this.auth.register(input, contextOf(req, res));
    return { data: { user } };
  }

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ user: PublicUser }>> {
    const input = parseOrThrow(loginSchema, body);
    const { user, token, expiresAt } = await this.auth.login(input, contextOf(req, res));
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(this.config, expiresAt));
    return { data: { user } };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ loggedOut: true }>> {
    const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
    await this.auth.logout(token, contextOf(req, res));
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(this.config));
    return { data: { loggedOut: true } };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest): ApiSuccessResponse<{ user: PublicUser }> {
    // A guarda garante que authUser existe.
    return { data: { user: toPublicUser(req.authUser!) } };
  }
}
