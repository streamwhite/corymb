import { afterAll, describe, expect, it } from "bun:test";
import { RedisClient } from "bun";
import {
  RATE_LIMIT_STRATEGY_RELAXED,
  RATE_LIMIT_STRATEGY_STRICT,
} from "@/constants/rate-limit.js";
import { createRateLimiter, rateLimitClientKey } from "@/http/rate-limit.js";
import { consumeRedisCounter } from "@/http/rate-limit-redis.js";
import {
  REDIS_AVAILABLE,
  getTestRedisUrl,
  stopTestRedis,
} from "./helpers/test-redis.js";

afterAll(async () => {
  await stopTestRedis();
});

describe("rate limit client key", () => {
  it("prefers the first X-Forwarded-For address", () => {
    const headers = new Headers({
      "X-Forwarded-For": "203.0.113.7, 10.0.0.1",
      "X-Real-IP": "10.0.0.2",
    });
    expect(rateLimitClientKey(headers)).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP then a constant", () => {
    expect(rateLimitClientKey(new Headers({ "X-Real-IP": "10.0.0.2" }))).toBe(
      "10.0.0.2",
    );
    expect(rateLimitClientKey(new Headers())).toBe("unknown");
  });
});

describe("rate limiter (in-memory)", () => {
  it("allows up to the max then rejects with a retry-after", async () => {
    const limiter = createRateLimiter({ overrideMax: { strict: 2 } });
    expect(await limiter.check(RATE_LIMIT_STRATEGY_STRICT, "ip-1")).toEqual({
      ok: true,
    });
    expect(await limiter.check(RATE_LIMIT_STRATEGY_STRICT, "ip-1")).toEqual({
      ok: true,
    });
    const third = await limiter.check(RATE_LIMIT_STRATEGY_STRICT, "ip-1");
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.retryAfterSec).toBeGreaterThan(0);
    }
    limiter.close();
  });

  it("isolates strategies and client keys", async () => {
    const limiter = createRateLimiter({
      overrideMax: { strict: 1, relaxed: 5 },
    });
    expect((await limiter.check(RATE_LIMIT_STRATEGY_STRICT, "a")).ok).toBe(true);
    expect((await limiter.check(RATE_LIMIT_STRATEGY_RELAXED, "a")).ok).toBe(true);
    expect((await limiter.check(RATE_LIMIT_STRATEGY_STRICT, "b")).ok).toBe(true);
    expect((await limiter.check(RATE_LIMIT_STRATEGY_STRICT, "a")).ok).toBe(false);
    limiter.close();
  });
});

describe("rate limit redis reply parsing", () => {
  it("coerces string counters to numbers", async () => {
    const fake = {
      send: async () => ["3", "1200"],
    } as unknown as RedisClient;
    expect(await consumeRedisCounter(fake, "k", 1, 60)).toEqual([3, 1200]);
  });

  it("rejects an unexpected Redis reply shape", async () => {
    const fake = {
      send: async () => "not-an-array",
    } as unknown as RedisClient;
    await expect(consumeRedisCounter(fake, "k", 1, 60)).rejects.toThrow(
      "Unexpected Redis rate-limit reply",
    );
  });
});

describe.skipIf(!REDIS_AVAILABLE)("rate limiter (redis)", () => {
  it("counts atomically with the Lua fixed-window counter", async () => {
    const client = new RedisClient(await getTestRedisUrl(), { autoReconnect: false });
    const key = `test:${crypto.randomUUID()}`;
    try {
      const first = await consumeRedisCounter(client, key, 1, 60);
      const second = await consumeRedisCounter(client, key, 1, 60);
      expect(first[0]).toBe(1);
      expect(second[0]).toBe(2);
      expect(second[1]).toBeGreaterThan(0);
      await client.send("DEL", [key]);
    } finally {
      client.close();
    }
  });

  it("shares counts across limiter instances for the same key", async () => {
    const url = await getTestRedisUrl();
    const options = { redisUrl: url, overrideMax: { strict: 2 } };
    const limiterA = createRateLimiter(options);
    const limiterB = createRateLimiter(options);
    const key = crypto.randomUUID();
    expect((await limiterA.check(RATE_LIMIT_STRATEGY_STRICT, key)).ok).toBe(true);
    expect((await limiterB.check(RATE_LIMIT_STRATEGY_STRICT, key)).ok).toBe(true);
    const third = await limiterB.check(RATE_LIMIT_STRATEGY_STRICT, key);
    expect(third.ok).toBe(false);
    limiterA.close();
    limiterB.close();
  });
});
