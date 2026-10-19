import "reflect-metadata";
import { Logger, type Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { API_VERSION_PREFIX } from "@kivora/shared";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import type { AuthRepository } from "./auth/auth.repository.js";
import { InMemoryAuthRepository } from "./auth/in-memory-auth.repository.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { originCheckMiddleware } from "./common/origin-check.middleware.js";
import { requestIdMiddleware } from "./common/request-id.middleware.js";
import type { AppConfig } from "./config/env.js";

export interface CreateAppOptions {
  authRepository?: AuthRepository;
  extraControllers?: Type<unknown>[];
}

/** Cria a aplicação com todas as protecções base. Usada pelo arranque e pelos testes. */
export async function createApp(
  config: AppConfig,
  options: CreateAppOptions = {},
): Promise<NestExpressApplication> {
  let authRepository = options.authRepository;
  if (!authRepository) {
    if (config.nodeEnv === "production") {
      // O armazenamento em memória perde tudo ao reiniciar: nunca em produção.
      throw new Error("Persistência da autenticação não configurada: não é permitido arrancar em produção.");
    }
    new Logger("Bootstrap").warn(
      "A usar armazenamento de autenticação EM MEMÓRIA (apenas desenvolvimento): os dados perdem-se ao reiniciar.",
    );
    authRepository = new InMemoryAuthRepository();
  }

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register({
      config,
      authRepository,
      ...(options.extraControllers ? { extraControllers: options.extraControllers } : {}),
    }),
    { logger: config.nodeEnv === "test" ? false : ["log", "warn", "error"] },
  );

  if (config.trustProxy) app.set("trust proxy", 1);

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: [...config.corsAllowedOrigins],
    credentials: true,
  });
  app.use(originCheckMiddleware(config.corsAllowedOrigins));
  app.setGlobalPrefix(API_VERSION_PREFIX.replace(/^\//, ""));
  app.useGlobalFilters(new AllExceptionsFilter());

  return app;
}
