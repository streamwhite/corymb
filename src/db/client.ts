import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { resolveSqlitePathFromEnv } from "@/db/resolve-sqlite-path.js";
import * as schema from "@/db/schema.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export type DbBundle = {
  db: BunSQLiteDatabase<typeof schema>;
  sqlite: Database;
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

export function createDbBundle(options?: DbOptions): DbBundle {
  const dbPath = resolveDatabasePath(options);
  ensureParentDir(dbPath);
  const sqlite = new Database(dbPath);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(MODULE_DIR, "migrations") });
  return { db, sqlite };
}
