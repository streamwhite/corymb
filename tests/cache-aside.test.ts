import { afterAll, describe, expect, it } from "bun:test";
import { RedisClient } from "bun";
import { getOrLoad } from "@/cache/cache-aside.js";
import { closeCacheBundle, createCacheBundle } from "@/cache/client.js";
import type { Cache } from "@/cache/cache-types.js";
import { createNoopCache } from "@/cache/noop-cache.js";
import {
  createRedisCache,
  createRedisCacheBundle,
} from "@/cache/redis-cache.js";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import { VALID_TEST_USERNAME } from "./constants.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { signupUser } from "./helpers/auth-flow.js";
import {
  REDIS_AVAILABLE,
  getTestRedisUrl,
  stopTestRedis,
} from "./helpers/test-redis.js";

afterAll(async () => {
  await stopTestRedis();
});

type SampleRow = { id: string; name: string };

const validPassword = "x".repeat(MIN_PASSWORD_LENGTH);

function createMemoryCache(): Cache & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, _ttlSeconds: number): Promise<void> {
      store.set(key, value);
    },
    async del(key: string): Promise<void> {
      store.delete(key);
    },
    async ping(): Promise<void> {},
  };
}

describe("cache-aside", () => {
  it("noop cache always invokes loader", async () => {
    const cache = createNoopCache();
    let calls = 0;
    const loader = async (): Promise<SampleRow> => {
      calls += 1;
      return { id: "1", name: "a" };
    };
    const first = await getOrLoad({
      cache,
      key: "k",
      ttlSeconds: 60,
      loader,
    });
    const second = await getOrLoad({
      cache,
      key: "k",
      ttlSeconds: 60,
      loader,
    });
    expect(first).toEqual({ id: "1", name: "a" });
    expect(second).toEqual({ id: "1", name: "a" });
    expect(calls).toBe(2);
    await cache.set("k", "v", 1);
    await cache.del("k");
    await cache.ping();
  });

  it("memory cache hits skip loader and del forces reload", async () => {
    const cache = createMemoryCache();
    let calls = 0;
    const loader = async (): Promise<SampleRow> => {
      calls += 1;
      return { id: "2", name: "b" };
    };
    await getOrLoad({ cache, key: "user:1", ttlSeconds: 60, loader });
    await getOrLoad({ cache, key: "user:1", ttlSeconds: 60, loader });
    expect(calls).toBe(1);
    await cache.del("user:1");
    await getOrLoad({ cache, key: "user:1", ttlSeconds: 60, loader });
    expect(calls).toBe(2);
  });

  it("does not cache undefined loader results", async () => {
    const cache = createMemoryCache();
    let calls = 0;
    const loader = async (): Promise<SampleRow | undefined> => {
      calls += 1;
      return undefined;
    };
    await getOrLoad({ cache, key: "missing", ttlSeconds: 60, loader });
    await getOrLoad({ cache, key: "missing", ttlSeconds: 60, loader });
    expect(calls).toBe(2);
    expect(cache.store.size).toBe(0);
  });
});

describe("auth cache-aside", () => {
  it("sign-up stores session data in secondary storage cache", async () => {
    const memory = createMemoryCache();
    const { app } = await createMemoryApp({ cache: memory });
    const result = await signupUser(app.request, {
      email: "cached-signin@example.com",
      username: VALID_TEST_USERNAME,
      password: validPassword,
    });
    expect(result.status).toBe(200);
    expect(memory.store.size).toBeGreaterThan(0);
  });
});

describe("redis cache error handling", () => {
  it("swallows get/set/del failures and reports ping mismatches", async () => {
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      const failing = {
        async get() {
          throw new Error("get down");
        },
        async set() {
          throw new Error("set down");
        },
        async del() {
          throw new Error("del down");
        },
        async send() {
          return "NOTPONG";
        },
      } as unknown as RedisClient;
      const cache = createRedisCache(failing);
      expect(await cache.get("k")).toBeNull();
      await cache.set("k", "v", 10);
      await cache.del("k");
      await expect(cache.ping()).rejects.toThrow("unexpected reply");
      expect(errors.length).toBe(3);
    } finally {
      console.error = originalError;
    }
  });
});

describe.skipIf(!REDIS_AVAILABLE)("cache-aside redis integration", () => {
  it("round-trips through Redis and reuses the cached value", async () => {
    const url = await getTestRedisUrl();
    const bundle = await createRedisCacheBundle({ url });
    const testKey = `test:cache-aside:${crypto.randomUUID()}`;
    let calls = 0;
    const loader = async (): Promise<SampleRow> => {
      calls += 1;
      return { id: "r", name: "redis" };
    };
    try {
      await bundle.cache.ping();
      await getOrLoad({ cache: bundle.cache, key: testKey, ttlSeconds: 30, loader });
      await getOrLoad({ cache: bundle.cache, key: testKey, ttlSeconds: 30, loader });
      expect(calls).toBe(1);
      await bundle.cache.del(testKey);
      expect(await bundle.cache.get(testKey)).toBeNull();
    } finally {
      bundle.close();
    }
  });

  it("builds a redis bundle through the driver factory", async () => {
    const url = await getTestRedisUrl();
    const bundle = await createCacheBundle({ redisUrl: url });
    try {
      await bundle.cache.set("factory-key", "v", 30);
      expect(await bundle.cache.get("factory-key")).toBe("v");
      await bundle.cache.del("factory-key");
    } finally {
      closeCacheBundle(bundle);
    }
  });
});
