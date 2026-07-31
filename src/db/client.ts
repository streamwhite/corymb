import { SQL } from "bun";
import { mkdirSync } from "fs";
import path from "path";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { bunSqliteConnectionUrl } from "@/constants/sqlite-url.js";
import { applyMigrations } from "@/db/apply-migrations.js";
import { resolveMigrationsFolder } from "@/db/migrations-path.js";
import { resolveSqlitePathFromEnv } from "@/db/resolve-sqlite-path.js";

export type DbBundle = {
  sql: SQL;
  databasePath: string;
};

export type DbOptions = {
  databasePath?: string;
};

function resolveDatabasePath(options?: DbOptions): string {
  if (options?.databasePath !== undefined) {
    return options.databasePath;
  }
  return resolveSqlitePathFromEnv();
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
  const dbPath = resolveDatabasePath(options);
  ensureParentDir(dbPath);
  const url = bunSqliteConnectionUrl(dbPath);
  const sql = new SQL(url);
  await configureSqlitePragmas(sql);
  await applyMigrations(sql, resolveMigrationsFolder());
  return { sql, databasePath: dbPath };
}

export async function closeDbBundle(bundle: DbBundle): Promise<void> {
  await bundle.sql.close();
}
