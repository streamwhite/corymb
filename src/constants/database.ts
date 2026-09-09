import path from "path";
import {
  DEFAULT_DATA_DIR,
  DEFAULT_DB_FILENAME,
  ENV_SQLITE_PATH,
  SQLITE_IN_MEMORY,
} from "@/constants/sqlite.js";

export const ENV_DATABASE_URL = "DATABASE_URL" as const;

export type DbDialect = "sqlite" | "postgres";

export type DatabaseConfig = {
  dialect: DbDialect;
  /** Postgres connection URL (dialect === "postgres"). */
  pgUrl?: string;
  /** SQLite file path or `:memory:` (dialect === "sqlite"). */
  sqlitePath?: string;
};

const POSTGRES_URL_PREFIXES = ["postgres://", "postgresql://"] as const;

export function isPostgresUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return POSTGRES_URL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Dialect resolution: `DATABASE_URL` wins. A postgres URL selects the
 * postgres dialect; any other value is treated as a SQLite path.
 * Without `DATABASE_URL`, falls back to `SQLITE_PATH` (or the default file).
 */
export function resolveDatabaseConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): DatabaseConfig {
  const url = env[ENV_DATABASE_URL]?.trim();
  if (url !== undefined && url.length > 0) {
    if (isPostgresUrl(url)) {
      return { dialect: "postgres", pgUrl: url };
    }
    return { dialect: "sqlite", sqlitePath: url };
  }
  return { dialect: "sqlite", sqlitePath: resolveSqlitePathFromEnv(env) };
}

/** Matches server defaults: `SQLITE_PATH` env or `<cwd>/data/items.sqlite`. */
export function resolveSqlitePathFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const envPath = env[ENV_SQLITE_PATH];
  if (envPath !== undefined && envPath.length > 0) {
    return envPath;
  }
  return path.join(process.cwd(), DEFAULT_DATA_DIR, DEFAULT_DB_FILENAME);
}

export { SQLITE_IN_MEMORY };
