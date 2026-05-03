import path from "node:path";
import { defineConfig } from "drizzle-kit";
import {
  DEFAULT_DATA_DIR,
  DEFAULT_DB_FILENAME,
} from "./src/constants/sqlite.js";

const DB_FILE = path.join(process.cwd(), DEFAULT_DATA_DIR, DEFAULT_DB_FILENAME);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: `file:${DB_FILE}` },
});
