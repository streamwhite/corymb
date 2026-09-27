export const ENV_DATABASE_URL = "DATABASE_URL" as const;

/** Postgres schema that holds Better Auth tables (auth exception, see ADR). */
export const AUTH_DB_SCHEMA = "auth" as const;

/** Postgres schema exposed through PostgREST for application data. */
export const APP_DB_SCHEMA = "app" as const;

export type DatabaseConfig = {
  /** PostgreSQL connection URL (admin/migration connection). */
  pgUrl: string;
};

const POSTGRES_URL_PREFIXES = ["postgres://", "postgresql://"] as const;

export function isPostgresUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return POSTGRES_URL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Runtime/admin connection URL. SQLite is no longer supported: the value must
 * be a PostgreSQL URL. Missing or non-Postgres values throw so misconfiguration
 * fails fast at startup instead of silently degrading.
 */
export function resolvePgUrlFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const url = env[ENV_DATABASE_URL]?.trim();
  if (url === undefined || url.length === 0) {
    throw new Error(
      `${ENV_DATABASE_URL} is required (PostgreSQL URL, e.g. postgres://user:pass@host:5432/db)`,
    );
  }
  if (!isPostgresUrl(url)) {
    throw new Error(
      `${ENV_DATABASE_URL} must be a PostgreSQL URL (postgres:// or postgresql://); SQLite is no longer supported`,
    );
  }
  return url;
}

export function resolveDatabaseConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): DatabaseConfig {
  return { pgUrl: resolvePgUrlFromEnv(env) };
}

/** Returns a copy of `pgUrl` whose connections run with `search_path=<schema>`. */
export function buildSchemaConnectionUrl(pgUrl: string, schema: string): string {
  const url = new URL(pgUrl);
  const option = `-c search_path=${schema}`;
  url.searchParams.set("options", option);
  return url.toString();
}
