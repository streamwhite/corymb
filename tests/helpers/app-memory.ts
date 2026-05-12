import { type CreateAppOptions, createApp } from "@/app.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { scheduleTestDispose } from "../dispose-guard.js";

export async function createMemoryApp(options?: CreateAppOptions) {
  const app = await createApp({
    databasePath: SQLITE_IN_MEMORY,
    ...options,
  });
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    routes: app.routes,
    fetch: app.fetchNotFound,
    error: app.onServeError,
  });
  const base = server.url.href;
  scheduleTestDispose(async () => {
    await server.stop(true);
    await app.close();
  });
  return {
    app: {
      /** Uses real HTTP so `Bun.serve` `routes` are exercised (`server.fetch` bypasses them). */
      request: (path: string, init?: RequestInit) =>
        fetch(new URL(path, base).href, init),
    },
    sql: app.sql,
  };
}
