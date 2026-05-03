import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig } from "drizzle-kit";
import {
  DEFAULT_DATA_DIR,
  DEFAULT_DB_FILENAME,
  SQLITE_IN_MEMORY,
} from "./src/constants/sqlite.js";
import { resolveSqlitePathFromEnv } from "./src/db/resolve-sqlite-path.js";

/** Drizzle Kit CLI needs a file URL; `:memory:` is only valid at runtime for the app. */
function sqliteUrlForDrizzleKit(): string {
  const resolved = resolveSqlitePathFromEnv();
  const fsPath =
    resolved === SQLITE_IN_MEMORY
      ? path.join(process.cwd(), DEFAULT_DATA_DIR, DEFAULT_DB_FILENAME)
      : resolved;
  if (resolved === SQLITE_IN_MEMORY) {
    console.warn(
      "[drizzle.config] SQLITE_PATH is :memory: — Drizzle CLI targets the default file DB instead.",
    );
  }
  return pathToFileURL(fsPath).href;
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: sqliteUrlForDrizzleKit() },
});
