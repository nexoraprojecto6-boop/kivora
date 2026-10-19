import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { API_VERSION_PREFIX } from "@kivora/shared";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { originCheckMiddleware } from "./common/origin-check.middleware.js";
import { requestIdMiddleware } from "./common/request-id.middleware.js";
import type { AppConfig } from "./config/env.js";

/** Cria a aplicação com todas as protecções base. Usada pelo arranque e pelos testes. */
export async function createApp(
  config: AppConfig,
  rootModule: unknown = AppModule,
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(rootModule as typeof AppModule, {
    logger: config.nodeEnv === "test" ? false : ["log", "warn", "error"],
  });

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
