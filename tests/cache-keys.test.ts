import { afterEach, describe, expect, it } from "bun:test";
import { getOrLoad } from "@/cache/cache-aside.js";
import type { Cache } from "@/cache/cache-types.js";
import {
  invalidateSession,
  invalidateUser,
} from "@/cache/invalidate.js";
import {
  sessionByIdKey,
  userByEmailKey,
  userByIdKey,
} from "@/cache/keys.js";
import {
  DEFAULT_CACHE_KEY_PREFIX,
  ENV_CACHE_KEY_PREFIX,
} from "@/constants/redis.js";

const originalPrefix = process.env[ENV_CACHE_KEY_PREFIX];

afterEach(() => {
  if (originalPrefix === undefined) {
    delete process.env[ENV_CACHE_KEY_PREFIX];
  } else {
    process.env[ENV_CACHE_KEY_PREFIX] = originalPrefix;
  }
});

function fakeCache(): Cache & { store: Map<string, string>; deleted: string[] } {
  const store = new Map<string, string>();
  const deleted: string[] = [];
  return {
    store,
    deleted,
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async del(key) {
      deleted.push(key);
      store.delete(key);
    },
    async ping() {},
  };
}

describe("cache key namespacing", () => {
  it("uses the default prefix when unset", () => {
    delete process.env[ENV_CACHE_KEY_PREFIX];
    expect(userByIdKey("u1")).toBe(`${DEFAULT_CACHE_KEY_PREFIX}user:id:u1`);
    expect(userByEmailKey("a@b.c")).toBe(
      `${DEFAULT_CACHE_KEY_PREFIX}user:email:a@b.c`,
    );
    expect(sessionByIdKey("s1")).toBe(`${DEFAULT_CACHE_KEY_PREFIX}session:id:s1`);
  });

  it("honors CACHE_KEY_PREFIX at call time", () => {
    process.env[ENV_CACHE_KEY_PREFIX] = "app:";
    expect(userByIdKey("u1")).toBe("app:user:id:u1");
    expect(sessionByIdKey("s1")).toBe("app:session:id:s1");
  });
});

describe("cache invalidation", () => {
  it("invalidates a user id and, when present, the email key", async () => {
    process.env[ENV_CACHE_KEY_PREFIX] = "app:";
    const cache = fakeCache();
    await invalidateUser(cache, { id: "u1", email: "a@b.c" });
    expect(cache.deleted.sort()).toEqual([
      "app:user:email:a@b.c",
      "app:user:id:u1",
    ]);
  });

  it("invalidates only the id when no email is given", async () => {
    process.env[ENV_CACHE_KEY_PREFIX] = "app:";
    const cache = fakeCache();
    await invalidateUser(cache, { id: "u1" });
    await invalidateUser(cache, { id: "u2", email: "" });
    expect(cache.deleted).toEqual(["app:user:id:u1", "app:user:id:u2"]);
  });

  it("invalidates a session key", async () => {
    process.env[ENV_CACHE_KEY_PREFIX] = "app:";
    const cache = fakeCache();
    await invalidateSession(cache, "s1");
    expect(cache.deleted).toEqual(["app:session:id:s1"]);
  });
});

describe("getOrLoad resilience", () => {
  it("ignores corrupt cached JSON and reloads", async () => {
    const cache = fakeCache();
    cache.store.set("k", "{not json");
    let calls = 0;
    const result = await getOrLoad({
      cache,
      key: "k",
      ttlSeconds: 30,
      loader: async () => {
        calls += 1;
        return { id: "1" };
      },
    });
    expect(result).toEqual({ id: "1" });
    expect(calls).toBe(1);
    expect(JSON.parse(cache.store.get("k") ?? "null")).toEqual({ id: "1" });
  });

  it("returns parsed cached values without invoking the loader", async () => {
    const cache = fakeCache();
    cache.store.set("k", JSON.stringify({ id: "cached" }));
    let calls = 0;
    const result = await getOrLoad({
      cache,
      key: "k",
      ttlSeconds: 30,
      loader: async () => {
        calls += 1;
        return { id: "fresh" };
      },
    });
    expect(result).toEqual({ id: "cached" });
    expect(calls).toBe(0);
  });
});
