export type NodeEnv = "development" | "test" | "production";

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  corsAllowedOrigins: readonly string[];
  /** Operações financeiras reais: desactivadas por defeito. */
  financialOperationsEnabled: boolean;
}

const NODE_ENVS: readonly NodeEnv[] = ["development", "test", "production"];

/**
 * Lê e valida a configuração a partir das variáveis de ambiente.
 * As mensagens de erro nomeiam a variável, nunca o seu valor.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawNodeEnv = env["NODE_ENV"] ?? "development";
  if (!NODE_ENVS.includes(rawNodeEnv as NodeEnv)) {
    throw new Error("NODE_ENV inválido: use development, test ou production.");
  }
  const nodeEnv = rawNodeEnv as NodeEnv;

  const rawPort = env["API_PORT"] ?? "3000";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("API_PORT inválido: use um inteiro entre 0 e 65535.");
  }

  const corsAllowedOrigins = (env["CORS_ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  if (nodeEnv === "production" && corsAllowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS é obrigatório em produção.");
  }

  // Só o valor exacto "true" activa a funcionalidade.
  const financialOperationsEnabled =
    env["FEATURE_FINANCIAL_OPERATIONS_ENABLED"] === "true";

  return { nodeEnv, port, corsAllowedOrigins, financialOperationsEnabled };
}
