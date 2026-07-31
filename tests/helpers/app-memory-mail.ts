import type { SQL } from "bun";
import { type CreateAppOptions, createApp } from "@/app.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  createInMemoryMailer,
  type InMemoryMailer,
} from "@/mail/in-memory-mailer.js";
import { scheduleTestDispose } from "../dispose-guard.js";

const TEST_AUTH_SECRET =
  "test-better-auth-secret-at-least-32-chars!!" as const;

export type MemoryAppWithMail = {
  app: {
    request: (path: string, init?: RequestInit) => Promise<Response>;
    requestWithCookies: (
      path: string,
      init?: RequestInit,
      cookieJar?: { value: string },
    ) => Promise<Response>;
  };
  mailer: InMemoryMailer;
  sql: SQL;
  base: string;
};

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

export async function createMemoryAppWithMailer(
  options?: CreateAppOptions,
): Promise<MemoryAppWithMail> {
  const mailer = createInMemoryMailer();
  const dir = mkdtempSync(join(tmpdir(), "ba-mail-"));
  const databasePath = join(dir, "test.sqlite");
  const app = await createApp({
    databasePath,
    cache: createMemoryCache(),
    authSecret: TEST_AUTH_SECRET,
    authBaseURL: "http://127.0.0.1",
    authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
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
    mailer,
    sql: app.sql,
    base,
  };
}
