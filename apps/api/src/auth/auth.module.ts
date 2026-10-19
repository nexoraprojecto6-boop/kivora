import { Module } from "@nestjs/common";
import type { AppConfig } from "../config/env.js";
import { APP_CONFIG } from "../config/tokens.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { PasswordHasher, STRONG_SCRYPT_PARAMS, TEST_SCRYPT_PARAMS } from "./password.service.js";
import { SessionService } from "./session.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    AuthGuard,
    {
      provide: PasswordHasher,
      inject: [APP_CONFIG],
      // Parâmetros baratos apenas quando NODE_ENV=test.
      useFactory: (config: AppConfig) =>
        new PasswordHasher(config.nodeEnv === "test" ? TEST_SCRYPT_PARAMS : STRONG_SCRYPT_PARAMS),
    },
  ],
})
export class AuthModule {}
