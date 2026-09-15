import { describe, expect, it } from "bun:test";

const UNREACHABLE_REDIS_URL = "redis://127.0.0.1:1" as const;

describe("createRedisCacheBundle", () => {
  it("rejects fast when Redis is unreachable instead of hanging", async () => {
    const { createRedisCacheBundle } = await import("@/cache/redis-cache.js");
    const startedAt = Date.now();
    try {
      await createRedisCacheBundle({ url: UNREACHABLE_REDIS_URL });
      throw new Error("expected rejection");
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      expect(String(err)).toContain("Redis");
      // Must fail quickly (probe timeout) rather than hang forever.
      expect(elapsed).toBeLessThan(5_000);
    }
  });
});
