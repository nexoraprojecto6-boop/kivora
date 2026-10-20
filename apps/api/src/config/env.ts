export type NodeEnv = "development" | "test" | "production";
export type DatabaseSsl = "off" | "verify" | "no-verify";

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
  /** Número de proxies de confiança à frente da API (0 = nenhum). Determina o IP do cliente. */
  trustProxyHops: number;
  /** Ligação PostgreSQL. Obrigatória em produção. */
  databaseUrl: string | undefined;
  databaseSsl: DatabaseSsl;
  /** Aplica as migrações SQL ao arrancar. */
  runMigrationsOnStart: boolean;
  /** Limites por IP (janela de 15 min no login, 1 h no registo). */
  loginIpLimit: number;
  registerIpLimit: number;
  /** Endpoint de diagnóstico do IP do cliente. Só para configurar o proxy; desligar depois. */
  enableDiagnostics: boolean;
}

const NODE_ENVS: readonly NodeEnv[] = ["development", "test", "production"];
const DB_SSL: readonly DatabaseSsl[] = ["off", "verify", "no-verify"];

function intFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const value = Number(env[name] ?? String(fallback));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} inválido: use um inteiro entre ${min} e ${max}.`);
  }
  return value;
}

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

  // O Render define PORT; API_PORT tem prioridade se existir.
  const port = intFromEnv({ P: env["API_PORT"] ?? env["PORT"] }, "P", 3000, 0, 65535);

  const corsAllowedOrigins = (env["CORS_ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  if (nodeEnv === "production" && corsAllowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS é obrigatório em produção.");
  }

  const rawDatabaseUrl = env["DATABASE_URL"]?.trim();
  const databaseUrl = rawDatabaseUrl ? rawDatabaseUrl : undefined;
  if (nodeEnv === "production" && !databaseUrl) {
    throw new Error("DATABASE_URL é obrigatória em produção.");
  }

  const rawSsl = env["DATABASE_SSL"] ?? "off";
  if (!DB_SSL.includes(rawSsl as DatabaseSsl)) {
    throw new Error("DATABASE_SSL inválido: use off, verify ou no-verify.");
  }

  const rawCookieDomain = env["COOKIE_DOMAIN"]?.trim();

  return {
    nodeEnv,
    port,
    corsAllowedOrigins,
    // Só o valor exacto "true" activa estas funcionalidades.
    financialOperationsEnabled: env["FEATURE_FINANCIAL_OPERATIONS_ENABLED"] === "true",
    registrationEnabled: env["REGISTRATION_ENABLED"] === "true",
    sessionTtlHours: intFromEnv(env, "SESSION_TTL_HOURS", 168, 1, 720),
    cookieDomain: rawCookieDomain ? rawCookieDomain : undefined,
    trustProxyHops: intFromEnv(env, "TRUST_PROXY_HOPS", 0, 0, 5),
    databaseUrl,
    databaseSsl: rawSsl as DatabaseSsl,
    runMigrationsOnStart: env["RUN_MIGRATIONS_ON_START"] === "true",
    loginIpLimit: intFromEnv(env, "LOGIN_IP_LIMIT", 10, 1, 100_000),
    registerIpLimit: intFromEnv(env, "REGISTER_IP_LIMIT", 5, 1, 100_000),
    enableDiagnostics: env["ENABLE_DIAGNOSTICS"] === "true",
  };
}
