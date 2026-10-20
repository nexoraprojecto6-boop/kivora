import { Logger } from "@nestjs/common";
import { createApp } from "./app.factory.js";
import { loadConfig } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { PgAuthRepository } from "./db/pg-auth.repository.js";
import { createPool } from "./db/pool.js";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  const config = loadConfig();

  const pool = config.databaseUrl ? createPool(config) : undefined;
  if (pool && config.runMigrationsOnStart) {
    const result = await runMigrations(pool);
    logger.log(`Migrações: ${result.applied.length} aplicada(s), ${result.alreadyApplied.length} já existente(s).`);
  }

  const app = await createApp(config, pool ? { authRepository: new PgAuthRepository(pool) } : {});
  app.enableShutdownHooks();
  await app.listen(config.port, "0.0.0.0");
  logger.log(`API a ouvir na porta ${config.port}`);

  const shutdown = async (): Promise<void> => {
    await app.close();
    await pool?.end();
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

bootstrap().catch((error: unknown) => {
  // Nunca imprimir a configuração: pode conter a ligação à base de dados.
  new Logger("Bootstrap").error(error instanceof Error ? `${error.name}: ${error.message}` : "Falha ao arrancar");
  process.exit(1);
});
