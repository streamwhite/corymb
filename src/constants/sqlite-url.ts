import path from "path";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";

const SQLITE_PROTOCOL = "sqlite:" as const;
const SQLITE_AUTHORITY_PREFIX = "//" as const;

/** Bun `SQL` adapter URL for an in-memory SQLite database. */
export const SQLITE_MEMORY_SQL_URL =
  `${SQLITE_PROTOCOL}${SQLITE_AUTHORITY_PREFIX}:memory:` as const;

export function bunSqliteConnectionUrl(dbPath: string): string {
  if (dbPath === SQLITE_IN_MEMORY) {
    return SQLITE_MEMORY_SQL_URL;
  }
  const abs = path.resolve(dbPath);
  return `${SQLITE_PROTOCOL}${SQLITE_AUTHORITY_PREFIX}${abs}`;
}
