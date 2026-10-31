import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  type AgreementDto, type ApiSuccessResponse, type DepositDto, type EarningsSeriesDto, type SubscriptionLiveDto, type SubscriptionPanelDto, type NotificationDto, type PaymentAccountDto, type PaymentMethodDto, type PlanDto, type SubscriptionDto,
  type TicketDetailDto, type TicketDto, type TransactionDto, type VerificationDto, type WalletDto, type WithdrawalDto,
} from "@kivora/shared";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { AgreementsService } from "./agreements.service.js";
import { NotificationsService, SupportService } from "./engagement.service.js";
import { body, idOf, idemOf, qInt, qStr, requestIdOf, userIdOf } from "./http.js";
import { PaymentsService } from "./payments.service.js";
import { PlanEarningsService } from "./plan-earnings.service.js";
import { PlansService } from "./plans.service.js";
import { createDepositSchema, createWithdrawalSchema, messageSchema, paymentAccountSchema, proofSchema, subscribeSchema, ticketSchema, verificationSchema } from "./schemas.js";
import { VerificationService } from "./verification.service.js";

type R<T> = Promise<ApiSuccessResponse<T>>;
const ok = <T>(data: T): ApiSuccessResponse<T> => ({ data });

/** Carteira, histórico, métodos, depósitos e levantamentos do próprio utilizador. */
@Controller()
@UseGuards(AuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("wallet")
  async wallet(@Req() req: AuthenticatedRequest): R<WalletDto> {
    return ok(await this.payments.wallet(userIdOf(req)));
  }

  @Get("transactions")
  async transactions(@Req() req: AuthenticatedRequest, @Query() q: Record<string, unknown>): R<{ items: TransactionDto[]; nextCursor: string | null }> {
    return ok(
      await this.payments.transactions(userIdOf(req), {
        kind: qStr(q["kind"], /^(DEPOSIT|WITHDRAWAL|SUBSCRIPTION)$/),
        q: qStr(q["q"]),
        cursor: qStr(q["cursor"], /^[0-9TZ:.+-]{10,40}\|[0-9a-f-]{36}$/),
        limit: qInt(q["limit"], 20, 50),
      }),
    );
  }

  @Get("payment-methods")
  async methods(@Query() q: Record<string, unknown>): R<PaymentMethodDto[]> {
    return ok(await this.payments.methods(qStr(q["kind"], /^(DEPOSIT|WITHDRAWAL)$/) as "DEPOSIT" | "WITHDRAWAL" | null));
  }

  @Post("deposits")
  @HttpCode(201)
  async createDeposit(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<DepositDto> {
    return ok(await this.payments.createDeposit(userIdOf(req), body(createDepositSchema, b), idemOf(req), requestIdOf(req)));
  }
  @Get("deposits")
  async deposits(@Req() req: AuthenticatedRequest): R<DepositDto[]> {
    return ok(await this.payments.listDeposits(userIdOf(req)));
  }
  @Get("deposits/:id")
  async deposit(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<DepositDto> {
    return ok(await this.payments.getDeposit(userIdOf(req), idOf(id)));
  }
  @Post("deposits/:id/proof")
  @HttpCode(200)
  async depositProof(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<DepositDto> {
    return ok(await this.payments.submitProof(userIdOf(req), idOf(id), body(proofSchema, b), requestIdOf(req)));
  }
  @Post("deposits/:id/cancel")
  @HttpCode(200)
  async cancelDeposit(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<DepositDto> {
    return ok(await this.payments.cancelDeposit(userIdOf(req), idOf(id), requestIdOf(req)));
  }

  @Get("payment-accounts")
  async accounts(@Req() req: AuthenticatedRequest): R<PaymentAccountDto[]> {
    return ok(await this.payments.listAccounts(userIdOf(req)));
  }
  @Post("payment-accounts")
  @HttpCode(201)
  async addAccount(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<PaymentAccountDto> {
    return ok(await this.payments.addAccount(userIdOf(req), body(paymentAccountSchema, b)));
  }
  @Delete("payment-accounts/:id")
  @HttpCode(200)
  async deleteAccount(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<{ deleted: true }> {
    await this.payments.deleteAccount(userIdOf(req), idOf(id));
    return ok({ deleted: true });
  }

  @Post("withdrawals")
  @HttpCode(201)
  async createWithdrawal(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<WithdrawalDto> {
    return ok(await this.payments.createWithdrawal(userIdOf(req), body(createWithdrawalSchema, b), idemOf(req), requestIdOf(req)));
  }
  @Get("withdrawals")
  async withdrawals(@Req() req: AuthenticatedRequest): R<WithdrawalDto[]> {
    return ok(await this.payments.listWithdrawals(userIdOf(req)));
  }
  @Get("withdrawals/:id")
  async withdrawal(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<WithdrawalDto> {
    return ok(await this.payments.getWithdrawal(userIdOf(req), idOf(id)));
  }
  @Post("withdrawals/:id/cancel")
  @HttpCode(200)
  async cancelWithdrawal(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<WithdrawalDto> {
    return ok(await this.payments.cancelWithdrawal(userIdOf(req), idOf(id), requestIdOf(req)));
  }
}

@Controller()
@UseGuards(AuthGuard)
export class PlansController {
  constructor(private readonly plans: PlansService, private readonly earnings: PlanEarningsService) {}

  @Get("plans")
  async list(): R<PlanDto[]> {
    return ok(await this.plans.list());
  }
  @Get("plans/:id")
  async get(@Param("id") id: string): R<PlanDto> {
    return ok(await this.plans.get(idOf(id)));
  }
  @Get("plans/:id/image")
  async image(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const f = await this.plans.image(idOf(id));
    res.set({
      "Content-Type": f.mime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Content-Disposition": "inline",
    });
    res.end(f.content);
  }
  @Post("plans/:id/subscriptions")
  @HttpCode(201)
  async subscribe(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<SubscriptionDto> {
    return ok(await this.plans.subscribe(userIdOf(req), idOf(id), body(subscribeSchema, b).amountMinor, idemOf(req), requestIdOf(req)));
  }
  @Get("subscriptions")
  async mine(@Req() req: AuthenticatedRequest): R<SubscriptionDto[]> {
    return ok(await this.plans.listMine(userIdOf(req)));
  }
  @Post("subscriptions/:id/cancel")
  @HttpCode(200)
  async cancel(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<SubscriptionDto> {
    return ok(await this.plans.cancel(userIdOf(req), idOf(id), requestIdOf(req)));
  }

  /* Painel do plano: tudo vem do servidor. */
  @Get("subscriptions/:id/panel")
  async panel(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<SubscriptionPanelDto> {
    return ok(await this.earnings.panel(userIdOf(req), idOf(id)));
  }
  @Get("subscriptions/:id/live")
  async live(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Query() q: Record<string, unknown>): R<SubscriptionLiveDto> {
    const since = qStr(q["since"], /^[0-9TZ:.+-]{10,40}$/);
    const date = since ? new Date(since) : null;
    return ok(await this.earnings.live(userIdOf(req), idOf(id), date && !Number.isNaN(date.getTime()) ? date : null));
  }
  @Get("subscriptions/:id/series")
  async series(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Query() q: Record<string, unknown>): R<EarningsSeriesDto> {
    const bucket = qStr(q["bucket"], /^(minute|hour|day)$/) ?? "hour";
    return ok(await this.earnings.series(userIdOf(req), idOf(id), bucket as "minute" | "hour" | "day"));
  }
  @Post("subscriptions/:id/claim")
  @HttpCode(200)
  async claim(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<SubscriptionLiveDto> {
    return ok(await this.earnings.claim(userIdOf(req), idOf(id), requestIdOf(req)));
  }
}

@Controller()
@UseGuards(AuthGuard)
export class AccountController {
  constructor(
    private readonly agreements: AgreementsService,
    private readonly verification: VerificationService,
    private readonly notifications: NotificationsService,
    private readonly support: SupportService,
  ) {}

  @Get("agreements")
  async listAgreements(@Req() req: AuthenticatedRequest): R<AgreementDto[]> {
    return ok(await this.agreements.list(userIdOf(req)));
  }
  @Post("agreements/:versionId/accept")
  @HttpCode(200)
  async accept(@Req() req: AuthenticatedRequest, @Param("versionId") id: string): R<AgreementDto[]> {
    return ok(await this.agreements.accept(userIdOf(req), idOf(id), requestIdOf(req)));
  }

  @Get("verification")
  async verificationStatus(@Req() req: AuthenticatedRequest): R<{ submission: VerificationDto | null }> {
    return ok({ submission: await this.verification.latest(userIdOf(req)) });
  }
  @Post("verification")
  @HttpCode(201)
  async submitVerification(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<{ submission: VerificationDto }> {
    return ok({ submission: await this.verification.submit(userIdOf(req), body(verificationSchema, b), requestIdOf(req)) });
  }

  @Get("notifications")
  async listNotifications(@Req() req: AuthenticatedRequest, @Query() q: Record<string, unknown>): R<{ items: NotificationDto[]; unread: number }> {
    return ok(await this.notifications.list(userIdOf(req), q["unread"] === "true"));
  }
  @Post("notifications/read-all")
  @HttpCode(200)
  async readAll(@Req() req: AuthenticatedRequest): R<{ updated: number }> {
    return ok({ updated: await this.notifications.markAllRead(userIdOf(req)) });
  }
  @Post("notifications/:id/read")
  @HttpCode(200)
  async read(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<{ read: true }> {
    await this.notifications.markRead(userIdOf(req), idOf(id));
    return ok({ read: true });
  }

  @Get("support/tickets")
  async tickets(@Req() req: AuthenticatedRequest): R<TicketDto[]> {
    return ok(await this.support.listMine(userIdOf(req)));
  }
  @Post("support/tickets")
  @HttpCode(201)
  async createTicket(@Req() req: AuthenticatedRequest, @Body() b: unknown): R<TicketDetailDto> {
    return ok(await this.support.create(userIdOf(req), body(ticketSchema, b), requestIdOf(req)));
  }
  @Get("support/tickets/:id")
  async ticket(@Req() req: AuthenticatedRequest, @Param("id") id: string): R<TicketDetailDto> {
    return ok(await this.support.detail(userIdOf(req), idOf(id)));
  }
  @Post("support/tickets/:id/messages")
  @HttpCode(201)
  async message(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() b: unknown): R<TicketDetailDto> {
    return ok(await this.support.addMessage(userIdOf(req), idOf(id), body(messageSchema, b).message));
  }
}
