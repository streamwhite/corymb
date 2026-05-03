import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  DEFAULT_DATA_DIR,
  DEFAULT_DB_FILENAME,
  ENV_SQLITE_PATH,
  SQLITE_IN_MEMORY,
} from "@/constants/sqlite.js";
import * as schema from "@/db/schema.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export type DbBundle = {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
};

export type DbOptions = {
  databasePath?: string;
};

function resolveDatabasePath(options?: DbOptions): string {
  if (options?.databasePath !== undefined) {
    return options.databasePath;
  }
  const envPath = process.env[ENV_SQLITE_PATH];
  if (envPath !== undefined && envPath.length > 0) {
    return envPath;
  }
  return path.join(process.cwd(), DEFAULT_DATA_DIR, DEFAULT_DB_FILENAME);
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
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(MODULE_DIR, "migrations") });
  return { db, sqlite };
}
