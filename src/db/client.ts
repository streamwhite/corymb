import { SQL } from "bun";
import { mkdirSync } from "fs";
import path from "path";
import {
  type DatabaseConfig,
  type DbDialect,
  resolveDatabaseConfigFromEnv,
} from "@/constants/database.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { bunSqliteConnectionUrl } from "@/constants/sqlite-url.js";
import { applyMigrations } from "@/db/apply-migrations.js";
import { resolveMigrationsFolder } from "@/db/migrations-path.js";

export type DbBundle = {
  sql: SQL;
  dialect: DbDialect;
  sqlitePath?: string;
  pgUrl?: string;
};

export type DbOptions = {
  /** SQLite override (tests); wins over `DATABASE_URL`/`SQLITE_PATH`. */
  databasePath?: string;
  /** Full override (tests); wins over env when set. */
  databaseConfig?: DatabaseConfig;
};

function resolveConfig(options?: DbOptions): DatabaseConfig {
  if (options?.databaseConfig !== undefined) {
    return options.databaseConfig;
  }
  if (options?.databasePath !== undefined) {
    return { dialect: "sqlite", sqlitePath: options.databasePath };
  }
  return resolveDatabaseConfigFromEnv();
}

function ensureParentDir(dbPath: string): void {
  if (dbPath === SQLITE_IN_MEMORY) {
    return;
  }
  mkdirSync(path.dirname(dbPath), { recursive: true });
}

async function configureSqlitePragmas(sql: SQL): Promise<void> {
  await sql.unsafe("PRAGMA journal_mode = WAL;");
  await sql.unsafe("PRAGMA foreign_keys = ON;");
}

export async function createDbBundle(options?: DbOptions): Promise<DbBundle> {
  const config = resolveConfig(options);
  let url: string;
  if (config.dialect === "postgres") {
    if (config.pgUrl === undefined || config.pgUrl.length === 0) {
      throw new Error("Postgres dialect requires a connection URL");
    }
    url = config.pgUrl;
  } else {
    const dbPath = config.sqlitePath ?? SQLITE_IN_MEMORY;
    ensureParentDir(dbPath);
    url = bunSqliteConnectionUrl(dbPath);
  }
  const sql = new SQL(url);
  try {
    if (config.dialect === "sqlite") {
      await configureSqlitePragmas(sql);
    }
    await applyMigrations(sql, resolveMigrationsFolder(config.dialect), config.dialect);
  } catch (err) {
    await sql.close().catch(() => {});
    throw err;
  }
  return {
    sql,
    dialect: config.dialect,
    sqlitePath: config.sqlitePath,
    pgUrl: config.pgUrl,
  };
}

export async function closeDbBundle(bundle: DbBundle): Promise<void> {
  await bundle.sql.close();
}
