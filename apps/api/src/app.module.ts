import { Module, type DynamicModule, type Type } from "@nestjs/common";
import type { AuthRepository } from "./auth/auth.repository.js";
import { AuthModule } from "./auth/auth.module.js";
import type { AppConfig } from "./config/env.js";
import { CoreModule } from "./core.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({})
export class AppModule {
  static register(options: {
    config: AppConfig;
    authRepository: AuthRepository;
    /** Controladores adicionais (usado nos testes). */
    extraControllers?: Type<unknown>[];
  }): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.register(options), AuthModule],
      controllers: [HealthController, ...(options.extraControllers ?? [])],
    };
  }
}
