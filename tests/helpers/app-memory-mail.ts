import { type AppInstance, type CreateAppOptions, createApp } from "@/app.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { createRateLimiter } from "@/http/rate-limit.js";
import {
  createInMemoryMailer,
  type InMemoryMailer,
} from "@/mail/in-memory-mailer.js";
import { createMemoryEventBus } from "@/realtime/event-bus.js";
import { createMemoryStorage } from "@/storage/memory-storage.js";
import { createNoopTaskQueue } from "@/tasks/task-queue.js";
import { scheduleTestDispose } from "../dispose-guard.js";
import { cookieRequest, type TestRequest } from "./app-memory.js";
import { createTestDatabase, dropTestDatabase } from "./test-db.js";

const TEST_AUTH_SECRET = "test-better-auth-secret-at-least-32-chars!!" as const;

export type MemoryAppWithMail = {
  app: {
    request: TestRequest;
    requestWithCookies: ReturnType<typeof cookieRequest>;
    /** The underlying framework instance (auth, audit, tasks, ...). */
    instance: AppInstance;
  };
  mailer: InMemoryMailer;
  base: string;
};

export async function createMemoryAppWithMailer(
  options?: CreateAppOptions,
): Promise<MemoryAppWithMail> {
  const mailer = createInMemoryMailer();
  const pgUrl = options?.databaseConfig?.pgUrl ?? (await createTestDatabase());
  const app = await createApp({
    rateLimiter: createRateLimiter(),
    taskQueueInstance: createNoopTaskQueue(),
    storage: createMemoryStorage(),
    cache: createMemoryCache(),
    events: createMemoryEventBus(),
    authSecret: TEST_AUTH_SECRET,
    authBaseURL: "http://127.0.0.1",
    authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
    mailer,
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
    mailer,
    base,
  };
}
