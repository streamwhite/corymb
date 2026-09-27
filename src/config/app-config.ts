import { ConfigReader } from "@/config/validation.js";
import {
  DEFAULT_BETTER_AUTH_URL,
  ENV_BETTER_AUTH_SECRET,
  ENV_BETTER_AUTH_URL,
  MIN_BETTER_AUTH_SECRET_BYTES,
} from "@/constants/better-auth.js";
import {
  CORS_WILDCARD,
  ENV_CORS_CREDENTIALS,
  ENV_CORS_ORIGINS,
} from "@/constants/cors.js";
import { APP_DB_SCHEMA, ENV_DATABASE_URL } from "@/constants/database.js";
import {
  DEFAULT_LOG_LEVEL,
  ENV_LOG_LEVEL,
  type LogLevel,
} from "@/constants/observability.js";
import {
  DEFAULT_POSTGREST_TIMEOUT_MS,
  ENV_POSTGREST_SCHEMA,
  ENV_POSTGREST_SERVICE_TOKEN,
  ENV_POSTGREST_TIMEOUT_MS,
  ENV_POSTGREST_URL,
} from "@/constants/postgrest.js";
import {
  DEFAULT_REDIS_URL,
  ENV_REDIS_URL,
  ENV_VALKEY_URL,
} from "@/constants/redis.js";
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_SERVICE_NAME,
  ENV_HOST_KEY,
  ENV_PORT_KEY,
  ENV_SERVICE_NAME,
} from "@/constants/server.js";
import { ENV_NODE_ENV } from "@/constants/tls-dev.js";

export type AppConfig = {
  env: { nodeEnv: string; serviceName: string };
  server: { port: number; host?: string };
  database: { url: string };
  postgrest: {
    url?: string;
    schema: string;
    timeoutMs: number;
    hasServiceToken: boolean;
  };
  redis: { url: string };
  cors: { origins: string[]; credentials: boolean };
  log: { level: LogLevel };
  auth: { baseURL: string; secret: string };
};

/**
 * Validates and snapshots all environment configuration in one pass. Throws
 * `ConfigError` listing every issue, so deployments fail fast and complete.
 */
export function loadAppConfig(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  const r = new ConfigReader(env);
  const config: AppConfig = {
    env: {
      nodeEnv: r.optionalString(ENV_NODE_ENV, "production") ?? "production",
      serviceName:
        r.optionalString(ENV_SERVICE_NAME, DEFAULT_SERVICE_NAME) ??
        DEFAULT_SERVICE_NAME,
    },
    server: {
      port: r.int(ENV_PORT_KEY, DEFAULT_HTTP_PORT),
      host: r.optionalString(ENV_HOST_KEY),
    },
    database: { url: r.postgresUrl(ENV_DATABASE_URL) },
    postgrest: {
      url: r.optionalUrl(ENV_POSTGREST_URL),
      schema:
        r.optionalString(ENV_POSTGREST_SCHEMA, APP_DB_SCHEMA) ?? APP_DB_SCHEMA,
      timeoutMs: r.int(ENV_POSTGREST_TIMEOUT_MS, DEFAULT_POSTGREST_TIMEOUT_MS),
      hasServiceToken:
        r.optionalString(ENV_POSTGREST_SERVICE_TOKEN) !== undefined,
    },
    redis: {
      url:
        r.optionalString(ENV_REDIS_URL) ??
        r.optionalString(ENV_VALKEY_URL) ??
        DEFAULT_REDIS_URL,
    },
    cors: {
      origins: r.list(ENV_CORS_ORIGINS),
      credentials: r.bool(ENV_CORS_CREDENTIALS, false),
    },
    log: { level: r.logLevel(ENV_LOG_LEVEL, DEFAULT_LOG_LEVEL) },
    auth: {
      baseURL:
        r.optionalString(ENV_BETTER_AUTH_URL, DEFAULT_BETTER_AUTH_URL) ??
        DEFAULT_BETTER_AUTH_URL,
      secret: r.secret(ENV_BETTER_AUTH_SECRET, MIN_BETTER_AUTH_SECRET_BYTES),
    },
  };
  if (config.cors.credentials && config.cors.origins.includes(CORS_WILDCARD)) {
    r.addIssue(
      `CORS_ORIGINS cannot be "${CORS_WILDCARD}" when CORS_CREDENTIALS is true`,
    );
  }
  r.finish();
  return config;
}
