import { Database } from "bun:sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "fs";
import path from "path";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { resolveMigrationsFolder } from "@/db/migrations-path.js";
import { resolveSqlitePathFromEnv } from "@/db/resolve-sqlite-path.js";
import * as schema from "@/db/schema.js";

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
  migrate(db, { migrationsFolder: resolveMigrationsFolder() });
  return { db, sqlite };
}
