export type NodeEnv = "development" | "test" | "production";

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  corsAllowedOrigins: readonly string[];
  /** Operações financeiras reais: desactivadas por defeito. */
  financialOperationsEnabled: boolean;
  /** Registo público: desactivado por defeito até estarem definidas as decisões 4 e 6. */
  registrationEnabled: boolean;
  /** Duração absoluta de uma sessão. */
  sessionTtlHours: number;
  /** Domínio opcional do cookie de sessão. */
  cookieDomain: string | undefined;
  /** Confiar no cabeçalho X-Forwarded-For (só atrás de um proxy conhecido). */
  trustProxy: boolean;
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

  const port = Number(env["API_PORT"] ?? "3000");
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

  const sessionTtlHours = Number(env["SESSION_TTL_HOURS"] ?? "168");
  if (!Number.isInteger(sessionTtlHours) || sessionTtlHours < 1 || sessionTtlHours > 720) {
    throw new Error("SESSION_TTL_HOURS inválido: use um inteiro entre 1 e 720.");
  }

  const rawCookieDomain = env["COOKIE_DOMAIN"]?.trim();

  return {
    nodeEnv,
    port,
    corsAllowedOrigins,
    // Só o valor exacto "true" activa estas funcionalidades.
    financialOperationsEnabled: env["FEATURE_FINANCIAL_OPERATIONS_ENABLED"] === "true",
    registrationEnabled: env["REGISTRATION_ENABLED"] === "true",
    sessionTtlHours,
    cookieDomain: rawCookieDomain ? rawCookieDomain : undefined,
    trustProxy: env["TRUST_PROXY"] === "true",
  };
}
