import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { AuthRepository } from "./auth/auth.repository.js";
import type { AppConfig } from "./config/env.js";
import { APP_CONFIG, AUTH_REPOSITORY } from "./config/tokens.js";

/** Disponibiliza a configuração e o repositório de autenticação a todos os módulos. */
@Global()
@Module({})
export class CoreModule {
  static register(options: { config: AppConfig; authRepository: AuthRepository }): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: APP_CONFIG, useValue: options.config },
        { provide: AUTH_REPOSITORY, useValue: options.authRepository },
      ],
      exports: [APP_CONFIG, AUTH_REPOSITORY],
    };
  }
}
