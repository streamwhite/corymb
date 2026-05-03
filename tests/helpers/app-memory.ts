import { createApp } from "@/app.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";

export function createMemoryApp() {
  return createApp({ databasePath: SQLITE_IN_MEMORY });
}
