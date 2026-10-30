import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import type { AdminReferralDto, ApiSuccessResponse, ReferralOverviewDto, ReferralSettingsDto } from "@kivora/shared";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { body, ctxOf, idOf, qStatus, userIdOf } from "./http.js";
import { ReferralsService } from "./referrals.service.js";
import { referralLevelsSchema, referralSettingsSchema } from "./schemas.js";
import { AdminOnlyGuard, StaffGuard } from "./staff.guard.js";

type R<T> = Promise<ApiSuccessResponse<T>>;
const ok = <T>(data: T): ApiSuccessResponse<T> => ({ data });

/** Painel "Convidar e ganhar" do próprio utilizador. Só leitura: nada vem do cliente. */
@Controller("referrals")
@UseGuards(AuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get("me")
  async me(@Req() req: AuthenticatedRequest): R<ReferralOverviewDto> {
    return ok(await this.referrals.overview(userIdOf(req)));
  }
}

/** Regras de convites, níveis e revisão de convites suspeitos. Só ADMIN. */
@Controller("admin/referrals")
@UseGuards(AuthGuard, StaffGuard, AdminOnlyGuard)
export class ReferralsAdminController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get("settings")
  async settings(): R<ReferralSettingsDto> {
    return ok(await this.referrals.adminSettings());
  }
  @Put("settings")
  async saveSettings(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<ReferralSettingsDto> {
    return ok(await this.referrals.adminSaveSettings(ctxOf(req), body(referralSettingsSchema, b)));
  }
  @Put("levels")
  async saveLevels(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<ReferralSettingsDto> {
    return ok(await this.referrals.adminSaveLevels(ctxOf(req), body(referralLevelsSchema, b).levels));
  }
  @Get()
  async list(@Query() q: Record<string, unknown>): R<AdminReferralDto[]> {
    return ok(await this.referrals.adminList(qStatus(q["status"])));
  }
  @Post(":id/clear")
  @HttpCode(200)
  async clear(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<{ done: true }> {
    await this.referrals.adminDecide(ctxOf(req), idOf(id), "clear");
    return ok({ done: true });
  }
  @Post(":id/reject")
  @HttpCode(200)
  async reject(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<{ done: true }> {
    await this.referrals.adminDecide(ctxOf(req), idOf(id), "reject");
    return ok({ done: true });
  }
  @Post("reconcile")
  @HttpCode(200)
  async reconcile(@Req() req: AuthenticatedRequest): R<{ referrers: number; paid: number }> {
    return ok(await this.referrals.adminReconcile(ctxOf(req)));
  }
}
