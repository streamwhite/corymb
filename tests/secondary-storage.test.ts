import { describe, expect, it } from "bun:test";
import type { Cache } from "@/cache/cache-types.js";
import { createSecondaryStorage } from "@/auth/secondary-storage.js";

type Recorded = { key: string; value: string; ttl: number };

function recordingCache(): Cache & {
  store: Map<string, string>;
  sets: Recorded[];
  deletes: string[];
} {
  const store = new Map<string, string>();
  const sets: Recorded[] = [];
  const deletes: string[] = [];
  return {
    store,
    sets,
    deletes,
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value, ttlSeconds) {
      sets.push({ key, value, ttl: ttlSeconds });
      store.set(key, value);
    },
    async del(key) {
      deletes.push(key);
      store.delete(key);
    },
    async ping() {},
  };
}

describe("secondary storage adapter", () => {
  it("delegates get and delete to the cache", async () => {
    const cache = recordingCache();
    cache.store.set("session:1", "payload");
    const storage = createSecondaryStorage(cache);
    expect(await storage.get("session:1")).toBe("payload");
    await storage.delete("session:1");
    expect(cache.deletes).toEqual(["session:1"]);
  });

  it("uses the given TTL and falls back for missing/non-positive TTLs", async () => {
    const cache = recordingCache();
    const storage = createSecondaryStorage(cache);
    await storage.set("a", "1", 120);
    await storage.set("b", "2");
    await storage.set("c", "3", 0);
    await storage.set("d", "4", -5);
    const ttlByKey = new Map(cache.sets.map((s) => [s.key, s.ttl]));
    expect(ttlByKey.get("a")).toBe(120);
    expect(ttlByKey.get("b")).toBe(60 * 60 * 24 * 7);
    expect(ttlByKey.get("c")).toBe(60 * 60 * 24 * 7);
    expect(ttlByKey.get("d")).toBe(60 * 60 * 24 * 7);
  });

  it("getAndDelete returns then removes the value", async () => {
    const cache = recordingCache();
    cache.store.set("otp:1", "123456");
    const storage = createSecondaryStorage(cache);
    expect(await storage.getAndDelete("otp:1")).toBe("123456");
    expect(cache.store.has("otp:1")).toBe(false);
    expect(await storage.getAndDelete("otp:missing")).toBeNull();
  });

  it("increments numeric values and treats non-numeric as zero", async () => {
    const cache = recordingCache();
    const storage = createSecondaryStorage(cache);
    expect(await storage.increment("c")).toBe(1);
    expect(await storage.increment("c")).toBe(2);
    cache.store.set("bad", "not-a-number");
    expect(await storage.increment("bad")).toBe(1);
    expect(cache.store.get("c")).toBe("2");
  });
});
