import path from "node:path";
import {
  DEFAULT_DATA_DIR,
  DEFAULT_DB_FILENAME,
  ENV_SQLITE_PATH,
} from "@/constants/sqlite.js";

/** Matches server defaults: `SQLITE_PATH` env or `data/items.sqlite`. */
export function resolveSqlitePathFromEnv(): string {
  const envPath = process.env[ENV_SQLITE_PATH];
  if (envPath !== undefined && envPath.length > 0) {
    return envPath;
  }
  return path.join(process.cwd(), DEFAULT_DATA_DIR, DEFAULT_DB_FILENAME);
}
