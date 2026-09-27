import { type AppInstance, type CreateAppOptions, createApp } from "@/app.js";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { createRateLimiter } from "@/http/rate-limit.js";
import { createMemoryEventBus } from "@/realtime/event-bus.js";
import { createMemoryStorage } from "@/storage/memory-storage.js";
import { createNoopTaskQueue } from "@/tasks/task-queue.js";
import { scheduleTestDispose } from "../dispose-guard.js";
import { createTestDatabase, dropTestDatabase } from "./test-db.js";

const TEST_AUTH_SECRET = "test-better-auth-secret-at-least-32-chars!!" as const;

export type TestRequest = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

export type CookieJar = { value: string };

export type CookieRequest = (
  path: string,
  init?: RequestInit,
  cookieJar?: CookieJar,
) => Promise<Response>;

export type MemoryApp = {
  app: {
    /** Uses real HTTP so `Bun.serve` `routes` are exercised (`server.fetch` bypasses them). */
    request: TestRequest;
    requestWithCookies: CookieRequest;
    /** The underlying framework instance (audit, tasks, logger, ...). */
    instance: AppInstance;
  };
  auth: BetterAuthInstance;
  pgUrl: string;
  base: string;
};

export function mergeCookies(existing: string, setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const raw of setCookies) {
    const first = raw.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    map.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function cookieRequest(base: string): CookieRequest {
  return (path, init, cookieJar) => {
    const headers = new Headers(init?.headers);
    if (cookieJar !== undefined && cookieJar.value.length > 0) {
      headers.set("cookie", cookieJar.value);
    }
    return fetch(new URL(path, base).href, { ...init, headers }).then(
      async (res) => {
        const setCookie = res.headers.getSetCookie?.() ?? [];
        if (cookieJar !== undefined && setCookie.length > 0) {
          cookieJar.value = mergeCookies(cookieJar.value, setCookie);
        }
        return res;
      },
    );
  };
}

export async function createMemoryApp(
  options?: CreateAppOptions,
): Promise<MemoryApp> {
  const pgUrl = options?.databaseConfig?.pgUrl ?? (await createTestDatabase());
  const app = await createApp({
    // Tests run without Redis: in-memory limiter + noop task queue.
    rateLimiter: createRateLimiter(),
    taskQueueInstance: createNoopTaskQueue(),
    storage: createMemoryStorage(),
    cache: createMemoryCache(),
    events: createMemoryEventBus(),
    authSecret: TEST_AUTH_SECRET,
    authBaseURL: "http://127.0.0.1",
    authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
    ...options,
    databaseConfig: { pgUrl },
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
    await dropTestDatabase(pgUrl);
  });
  return {
    app: {
      request: (path, init) => fetch(new URL(path, base).href, init),
      requestWithCookies: cookieRequest(base),
      instance: app,
    },
    auth: app.auth,
    pgUrl,
    base,
  };
}
