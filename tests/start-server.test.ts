import { describe, expect, it } from "bun:test";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { HEALTH_BASE_PATH } from "@/constants/routes.js";
import { createRateLimiter } from "@/http/rate-limit.js";
import { createMemoryEventBus } from "@/realtime/event-bus.js";
import { startServer } from "@/server/start-server.js";
import { createMemoryStorage } from "@/storage/memory-storage.js";
import { createNoopTaskQueue } from "@/tasks/task-queue.js";
import {
  createTestDatabase,
  dropTestDatabase,
  PG_AVAILABLE,
} from "./helpers/test-db.js";

const TEST_AUTH_SECRET = "test-better-auth-secret-at-least-32-chars!!";

describe.skipIf(!PG_AVAILABLE)("startServer (library entry)", () => {
  it("boots a real server and answers on /health", async () => {
    const pgUrl = await createTestDatabase();
    const { server, app, url } = await startServer({
      databaseConfig: { pgUrl },
      cache: createMemoryCache(),
      rateLimiter: createRateLimiter(),
      taskQueueInstance: createNoopTaskQueue(),
      storage: createMemoryStorage(),
      events: createMemoryEventBus(),
      authSecret: TEST_AUTH_SECRET,
      authBaseURL: "http://127.0.0.1",
      authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
      port: 0,
      hostname: "127.0.0.1",
    });
    try {
      const res = await fetch(new URL(HEALTH_BASE_PATH, url.href));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok" });
    } finally {
      await server.stop(true);
      await app.close();
      await dropTestDatabase(pgUrl);
    }
  });
});
