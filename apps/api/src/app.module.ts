import { Module, type DynamicModule, type Type } from "@nestjs/common";
import type { AuthRepository } from "./auth/auth.repository.js";
import { AuthModule } from "./auth/auth.module.js";
import type { AppConfig } from "./config/env.js";
import { FinanceModule } from "./finance/finance.module.js";
import type { Pool } from "pg";
import { CoreModule } from "./core.module.js";
import { DiagnosticsController } from "./diagnostics/diagnostics.controller.js";
import { HealthController } from "./health/health.controller.js";

@Module({})
export class AppModule {
  static register(options: {
    config: AppConfig;
    authRepository: AuthRepository;
    /** Com base de dados, activa os módulos operacionais. */
    pool?: Pool;
    /** Controladores adicionais (usado nos testes). */
    extraControllers?: Type<unknown>[];
  }): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.register(options), AuthModule, ...(options.pool ? [FinanceModule.register(options.pool)] : [])],
      controllers: [HealthController, DiagnosticsController, ...(options.extraControllers ?? [])],
    };
  }
}
