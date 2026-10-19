import { createApp } from "./app.factory.js";
import { loadConfig } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.port);
}

void bootstrap();
