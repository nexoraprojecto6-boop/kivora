import { Module, type DynamicModule } from "@nestjs/common";
import type { Pool } from "pg";
import { AuthModule } from "../auth/auth.module.js";
import { AdminService } from "./admin.service.js";
import { AdminController, StaffController } from "./admin.controllers.js";
import { EmailController } from "./email.controller.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { Mailer } from "./mailer.service.js";
import { AgreementsService } from "./agreements.service.js";
import { NotificationsService, SupportService } from "./engagement.service.js";
import { FINANCE_CONFIG, FinanceGate, PG_POOL, loadFinanceConfig, type FinanceConfig } from "./finance.config.js";
import { PaymentsService } from "./payments.service.js";
import { ReferralsAdminController, ReferralsController } from "./referrals.controllers.js";
import { ReferralsService } from "./referrals.service.js";
import { PlansService } from "./plans.service.js";
import { AdminOnlyGuard, StaffGuard } from "./staff.guard.js";
import { AccountController, PaymentsController, PlansController } from "./user.controllers.js";
import { VerificationService } from "./verification.service.js";

/** Módulos operacionais (carteira, pedidos, planos, acordos, verificação, notificações, suporte, administração). Só com base de dados. */
@Module({})
export class FinanceModule {
  static register(pool: Pool, config: FinanceConfig = loadFinanceConfig()): DynamicModule {
    return {
      module: FinanceModule,
      imports: [AuthModule],
      controllers: [EmailController, PaymentsController, PlansController, AccountController, ReferralsController, StaffController, AdminController, ReferralsAdminController],
      providers: [
        { provide: PG_POOL, useValue: pool },
        { provide: FINANCE_CONFIG, useValue: config },
        Mailer, EmailVerificationService, FinanceGate, StaffGuard, AdminOnlyGuard,
        PaymentsService, PlansService, AgreementsService, VerificationService, NotificationsService, SupportService, AdminService, ReferralsService,
      ],
    };
  }
}
