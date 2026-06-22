import type { SQL } from "bun";
import { type CreateAppOptions, createApp } from "@/app.js";
import { createNoopCache } from "@/cache/noop-cache.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import {
  createInMemoryMailer,
  type InMemoryMailer,
} from "@/mail/in-memory-mailer.js";
import { scheduleTestDispose } from "../dispose-guard.js";

export type MemoryAppWithMail = {
  app: {
    request: (path: string, init?: RequestInit) => Promise<Response>;
  };
  mailer: InMemoryMailer;
  sql: SQL;
};

export async function createMemoryAppWithMailer(
  options?: CreateAppOptions,
): Promise<MemoryAppWithMail> {
  const mailer = createInMemoryMailer();
  const app = await createApp({
    databasePath: SQLITE_IN_MEMORY,
    cache: createNoopCache(),
    mailer,
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
      request: (path: string, init?: RequestInit) =>
        fetch(new URL(path, base).href, init),
    },
    mailer,
    sql: app.sql,
  };
}
