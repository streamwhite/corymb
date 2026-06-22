import { describe, expect, it } from "bun:test";
import { getOrLoad } from "@/cache/cache-aside.js";
import type { Cache } from "@/cache/cache-types.js";
import { createNoopCache } from "@/cache/noop-cache.js";
import { createRedisCache } from "@/cache/redis-cache.js";
import { RedisClient } from "bun";
import { ENV_REDIS_URL } from "@/constants/redis.js";
import {
  AUTH_SIGNIN_PATH,
  AUTH_SIGNUP_PATH,
} from "@/constants/routes.js";
import {
  HEADER_CONTENT_TYPE,
  MIME_JSON,
  VALID_TEST_USERNAME,
} from "./constants.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";

type SampleRow = { id: string; name: string };

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

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
  it("sign-in populates user cache for repeat lookups", async () => {
    const memory = createMemoryCache();
    const { app } = await createMemoryApp({ cache: memory });
    const email = "cached-signin@example.com";
    await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email,
        username: VALID_TEST_USERNAME,
        password: validPassword,
      }),
    });
    const signinBody = JSON.stringify({ email, password: validPassword });
    const first = await app.request(AUTH_SIGNIN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signinBody,
    });
    expect(first.status).toBe(200);
    expect(memory.store.size).toBeGreaterThan(0);
    const second = await app.request(AUTH_SIGNIN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signinBody,
    });
    expect(second.status).toBe(200);
  });
});

const redisUrl = process.env[ENV_REDIS_URL];

describe.skipIf(redisUrl === undefined || redisUrl.length === 0)(
  "cache-aside redis integration",
  () => {
    it("round-trips through Redis", async () => {
      const client = new RedisClient(redisUrl as string);
      const cache = createRedisCache(client);
      const testKey = `test:cache-aside:${crypto.randomUUID()}`;
      let calls = 0;
      const loader = async (): Promise<SampleRow> => {
        calls += 1;
        return { id: "r", name: "redis" };
      };
      try {
        await getOrLoad({
          cache,
          key: testKey,
          ttlSeconds: 30,
          loader,
        });
        await getOrLoad({
          cache,
          key: testKey,
          ttlSeconds: 30,
          loader,
        });
        expect(calls).toBe(1);
      } finally {
        await cache.del(testKey);
        client.close();
      }
    });
  },
);
