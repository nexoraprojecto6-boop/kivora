import { Body, Controller, Get, HttpCode, Param, Post, Put, Patch, Query, Req, Res, UseGuards } from "@nestjs/common";
import type {
  AdminDepositDto, AdminSubscriptionDto, AdminSummaryDto, AdminTicketDetailDto, AdminTicketDto, AdminUserDetailDto, AdminUserDto,
  AdminVerificationDto, AdminWithdrawalDto, ApiSuccessResponse, AuditEventDto, PaymentMethodDto, PlanDto,
} from "@kivora/shared";
import type { Response } from "express";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { AdminService } from "./admin.service.js";
import { AgreementsService } from "./agreements.service.js";
import { SupportService } from "./engagement.service.js";
import { body, ctxOf, idOf, qInt, qStatus, qStr } from "./http.js";
import { PaymentsService } from "./payments.service.js";
import { PlansService } from "./plans.service.js";
import { agreementSchema, messageSchema, methodSchema, noteSchema, planSchema, reasonSchema, userStatusSchema } from "./schemas.js";
import { AdminOnlyGuard, StaffGuard } from "./staff.guard.js";
import { VerificationService } from "./verification.service.js";

type R<T> = Promise<ApiSuccessResponse<T>>;
const ok = <T>(data: T): ApiSuccessResponse<T> => ({ data });

/** Rotas para SUPPORT e ADMIN: resumo, consulta de utilizadores e suporte. */
@Controller("admin")
@UseGuards(AuthGuard, StaffGuard)
export class StaffController {
  constructor(private readonly admin: AdminService, private readonly support: SupportService) {}

  @Get("summary")
  async summary(): R<AdminSummaryDto> {
    return ok(await this.admin.summary());
  }
  @Get("users")
  async users(@Query() q: Record<string, unknown>): R<AdminUserDto[]> {
    return ok(await this.admin.users(qStr(q["q"]), qInt(q["limit"], 50, 100)));
  }
  @Get("users/:id")
  async user(@Param("id") id: string): R<AdminUserDetailDto> {
    return ok(await this.admin.user(idOf(id)));
  }

  @Get("support/tickets")
  async tickets(@Query() q: Record<string, unknown>): R<AdminTicketDto[]> {
    return ok(await this.support.adminList(qStatus(q["status"])));
  }
  @Get("support/tickets/:id")
  async ticket(@Param("id") id: string): R<AdminTicketDetailDto> {
    return ok(await this.support.adminDetail(idOf(id)));
  }
  @Post("support/tickets/:id/messages")
  @HttpCode(201)
  async reply(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminTicketDetailDto> {
    return ok(await this.support.adminReply(ctxOf(req), idOf(id), body(messageSchema, b).message));
  }
  @Post("support/tickets/:id/close")
  @HttpCode(200)
  async close(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<AdminTicketDetailDto> {
    return ok(await this.support.adminClose(ctxOf(req), idOf(id)));
  }
}

/** Rotas só para ADMIN: configuração, decisões financeiras, verificação, acordos e auditoria. */
@Controller("admin")
@UseGuards(AuthGuard, StaffGuard, AdminOnlyGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payments: PaymentsService,
    private readonly plans: PlansService,
    private readonly agreements: AgreementsService,
    private readonly verification: VerificationService,
  ) {}

  @Patch("users/:id/status")
  async setStatus(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminUserDetailDto> {
    return ok(await this.admin.setStatus(ctxOf(req), idOf(id), body(userStatusSchema, b).status));
  }
  @Get("audit")
  async audit(@Query() q: Record<string, unknown>): R<AuditEventDto[]> {
    return ok(await this.admin.audit(qInt(q["limit"], 100, 200)));
  }

  /* Métodos de pagamento */
  @Get("payment-methods")
  async methods(): R<PaymentMethodDto[]> {
    return ok(await this.payments.adminMethods());
  }
  @Post("payment-methods")
  @HttpCode(201)
  async createMethod(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<PaymentMethodDto> {
    return ok(await this.payments.adminSaveMethod(null, body(methodSchema, b), ctxOf(req)));
  }
  @Put("payment-methods/:id")
  async updateMethod(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<PaymentMethodDto> {
    return ok(await this.payments.adminSaveMethod(idOf(id), body(methodSchema, b), ctxOf(req)));
  }

  /* Planos */
  @Get("plans")
  async listPlans(): R<PlanDto[]> {
    return ok(await this.plans.adminPlans());
  }
  @Post("plans")
  @HttpCode(201)
  async createPlan(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<PlanDto> {
    return ok(await this.plans.adminSavePlan(null, body(planSchema, b), ctxOf(req)));
  }
  @Put("plans/:id")
  async updatePlan(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<PlanDto> {
    return ok(await this.plans.adminSavePlan(idOf(id), body(planSchema, b), ctxOf(req)));
  }

  /* Depósitos */
  @Get("deposits")
  async deposits(@Query() q: Record<string, unknown>): R<AdminDepositDto[]> {
    return ok(await this.payments.adminDeposits(qStatus(q["status"])));
  }
  @Post("deposits/:id/confirm")
  @HttpCode(200)
  async confirmDeposit(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminDepositDto> {
    return ok(await this.payments.adminDecideDeposit(ctxOf(req), idOf(id), "confirm", body(noteSchema, b).note ?? ""));
  }
  @Post("deposits/:id/reject")
  @HttpCode(200)
  async rejectDeposit(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminDepositDto> {
    return ok(await this.payments.adminDecideDeposit(ctxOf(req), idOf(id), "reject", body(reasonSchema, b).note));
  }

  /* Levantamentos */
  @Get("withdrawals")
  async withdrawals(@Query() q: Record<string, unknown>): R<AdminWithdrawalDto[]> {
    return ok(await this.payments.adminWithdrawals(qStatus(q["status"])));
  }
  @Post("withdrawals/:id/approve")
  @HttpCode(200)
  async approveWithdrawal(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminWithdrawalDto> {
    return ok(await this.payments.adminDecideWithdrawal(ctxOf(req), idOf(id), "approve", body(noteSchema, b).note ?? ""));
  }
  @Post("withdrawals/:id/paid")
  @HttpCode(200)
  async payWithdrawal(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminWithdrawalDto> {
    return ok(await this.payments.adminDecideWithdrawal(ctxOf(req), idOf(id), "paid", body(noteSchema, b).note ?? ""));
  }
  @Post("withdrawals/:id/reject")
  @HttpCode(200)
  async rejectWithdrawal(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminWithdrawalDto> {
    return ok(await this.payments.adminDecideWithdrawal(ctxOf(req), idOf(id), "reject", body(reasonSchema, b).note));
  }

  /* Subscrições */
  @Get("subscriptions")
  async subscriptions(@Query() q: Record<string, unknown>): R<AdminSubscriptionDto[]> {
    return ok(await this.plans.adminSubscriptions(qStatus(q["status"])));
  }
  @Post("subscriptions/:id/approve")
  @HttpCode(200)
  async approveSub(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminSubscriptionDto> {
    return ok(await this.plans.adminDecide(ctxOf(req), idOf(id), "approve", body(noteSchema, b).note ?? ""));
  }
  @Post("subscriptions/:id/reject")
  @HttpCode(200)
  async rejectSub(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminSubscriptionDto> {
    return ok(await this.plans.adminDecide(ctxOf(req), idOf(id), "reject", body(reasonSchema, b).note));
  }

  /* Acordos */
  @Get("agreements")
  async listAgreements(): R<Awaited<ReturnType<AgreementsService["adminList"]>>> {
    return ok(await this.agreements.adminList());
  }
  @Post("agreements")
  @HttpCode(201)
  async publish(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<{ versionId: string; version: number }> {
    return ok(await this.agreements.publish(ctxOf(req), body(agreementSchema, b)));
  }

  /* Verificação de identidade */
  @Get("verifications")
  async verifications(@Query() q: Record<string, unknown>): R<AdminVerificationDto[]> {
    return ok(await this.verification.adminList(qStatus(q["status"])));
  }
  @Get("verifications/:id/files/:kind")
  async file(@Param("id") id: string, @Param("kind") kind: string, @Res() res: Response): Promise<void> {
    if (!/^(FRONT|BACK|SELFIE)$/.test(kind)) {
      res.status(404).end();
      return;
    }
    const f = await this.verification.adminFile(idOf(id), kind);
    res.set({
      "Content-Type": f.mime,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Content-Disposition": "inline",
    });
    res.end(f.content);
  }
  @Post("verifications/:id/approve")
  @HttpCode(200)
  async approve(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<AdminVerificationDto> {
    return ok(await this.verification.adminDecide(ctxOf(req), idOf(id), "approve", ""));
  }
  @Post("verifications/:id/reject")
  @HttpCode(200)
  async reject(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<AdminVerificationDto> {
    return ok(await this.verification.adminDecide(ctxOf(req), idOf(id), "reject", body(reasonSchema, b).note));
  }
}
