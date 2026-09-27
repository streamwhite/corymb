import { describe, expect, it } from "bun:test";
import * as pkg from "@/index.js";

describe("public package exports", () => {
  it("exports factory and server entry points", () => {
    expect(typeof pkg.createApp).toBe("function");
    expect(typeof pkg.startServer).toBe("function");
  });

  it("exports helpers consumers need to build features", () => {
    expect(typeof pkg.createMemoryCache).toBe("function");
    expect(typeof pkg.createCacheBundle).toBe("function");
    expect(typeof pkg.resolveCacheDriverFromEnv).toBe("function");
    expect(pkg.CACHE_DRIVER_MEMORY).toBe("memory");
    expect(pkg.CACHE_DRIVER_REDIS).toBe("redis");
    expect(typeof pkg.createMemoryEventBus).toBe("function");
    expect(typeof pkg.publishRealtimeEvent).toBe("function");
    expect(typeof pkg.withRateLimit).toBe("function");
    expect(typeof pkg.createRateLimiter).toBe("function");
    expect(typeof pkg.createTaskQueue).toBe("function");
    expect(typeof pkg.createNoopTaskQueue).toBe("function");
    expect(typeof pkg.createObjectStorage).toBe("function");
    expect(typeof pkg.createS3Storage).toBe("function");
    expect(typeof pkg.createIdempotencyGuard).toBe("function");
    expect(typeof pkg.withAudit).toBe("function");
    expect(typeof pkg.createGracefulShutdown).toBe("function");
    expect(typeof pkg.withTransaction).toBe("function");
    expect(typeof pkg.withSavepoint).toBe("function");
    expect(typeof pkg.createUnitOfWork).toBe("function");
    expect(typeof pkg.runInTransaction).toBe("function");
    expect(typeof pkg.migrationStatus).toBe("function");
    expect(typeof pkg.pendingMigrations).toBe("function");
    expect(typeof pkg.createMiddlewareRegistry).toBe("function");
    expect(typeof pkg.compose).toBe("function");
    expect(typeof pkg.withCompression).toBe("function");
    expect(typeof pkg.withValidation).toBe("function");
    expect(typeof pkg.withSession).toBe("function");
    expect(typeof pkg.withCookies).toBe("function");
    expect(typeof pkg.parseMultipartUpload).toBe("function");
    expect(typeof pkg.createSseResponse).toBe("function");
    expect(typeof pkg.createWebSocketServer).toBe("function");
    expect(typeof pkg.withRequestId).toBe("function");
    expect(typeof pkg.withErrorHandler).toBe("function");
    expect(pkg.HEADER_IDEMPOTENCY_KEY).toBe("Idempotency-Key");
    expect(typeof pkg.withBotDetection).toBe("function");
    expect(typeof pkg.classifyUserAgent).toBe("function");
    expect(typeof pkg.buildRobotsTxt).toBe("function");
    expect(pkg.HEALTH_BASE_PATH).toBe("/health");
    expect(pkg.ROBOTS_TXT_PATH).toBe("/robots.txt");
    expect(pkg.REALTIME_EVENTS_BASE_PATH).toBe("/realtime/events");
    expect(pkg.REALTIME_EVENTS_CHANNEL).toBe("realtime:events");
  });
});
