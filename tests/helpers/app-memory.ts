import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { type CreateAppOptions, createApp } from "@/app.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { scheduleTestDispose } from "../dispose-guard.js";

const TEST_AUTH_SECRET =
  "test-better-auth-secret-at-least-32-chars!!" as const;

export async function createMemoryApp(options?: CreateAppOptions) {
  const dir = mkdtempSync(join(tmpdir(), "ba-app-"));
  const databasePath = join(dir, "test.sqlite");
  const app = await createApp({
    databasePath,
    cache: createMemoryCache(),
    authSecret: TEST_AUTH_SECRET,
    authBaseURL: "http://127.0.0.1",
    authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
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
        fetch(new URL(path, base).href, {
          ...init,
          headers: init?.headers,
        }),
      requestWithCookies: (
        path: string,
        init?: RequestInit,
        cookieJar?: { value: string },
      ) => {
        const headers = new Headers(init?.headers);
        if (cookieJar !== undefined && cookieJar.value.length > 0) {
          headers.set("cookie", cookieJar.value);
        }
        return fetch(new URL(path, base).href, {
          ...init,
          headers,
        }).then(async (res) => {
          const setCookie = res.headers.getSetCookie?.() ?? [];
          if (cookieJar !== undefined && setCookie.length > 0) {
            cookieJar.value = mergeCookies(cookieJar.value, setCookie);
          }
          return res;
        });
      },
    },
    sql: app.sql,
    auth: app.auth,
    base,
  };
}

function mergeCookies(existing: string, setCookies: string[]): string {
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
