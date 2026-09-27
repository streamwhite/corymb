import { describe, expect, it } from "bun:test";
import { createMemoryCache } from "@/cache/memory-cache.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("memory cache (quick-lru)", () => {
  it("stores and retrieves values", async () => {
    const cache = createMemoryCache();
    await cache.set("k", "v", 60);
    expect(await cache.get("k")).toBe("v");
    expect(await cache.get("missing")).toBeNull();
  });

  it("deletes keys", async () => {
    const cache = createMemoryCache();
    await cache.set("k", "v", 60);
    await cache.del("k");
    expect(await cache.get("k")).toBeNull();
  });

  it("expires entries after their TTL", async () => {
    const cache = createMemoryCache();
    await cache.set("short", "v", 0.05);
    expect(await cache.get("short")).toBe("v");
    await sleep(80);
    expect(await cache.get("short")).toBeNull();
  });

  it("evicts the least-recently-used entries past maxItems", async () => {
    const cache = createMemoryCache({ maxItems: 2 });
    await cache.set("a", "1", 60);
    await cache.set("b", "2", 60);
    // Touch "a" so "b" becomes least-recently-used.
    await cache.get("a");
    await cache.set("c", "3", 60);

    expect(await cache.get("b")).toBeNull();
    expect(await cache.get("a")).toBe("1");
    expect(await cache.get("c")).toBe("3");
  });

  it("invokes onEviction when entries are evicted", async () => {
    const evicted: string[] = [];
    const cache = createMemoryCache({
      maxItems: 1,
      onEviction: (key) => {
        evicted.push(key);
      },
    });
    await cache.set("a", "1", 60);
    await cache.set("b", "2", 60);
    expect(evicted).toEqual(["a"]);
  });

  it("applies a fallback TTL when none is provided", async () => {
    const cache = createMemoryCache({ defaultTtlSeconds: 0.05 });
    await cache.set("k", "v", 0);
    expect(await cache.get("k")).toBe("v");
    await sleep(80);
    expect(await cache.get("k")).toBeNull();
  });

  it("resolves ping without error", async () => {
    const cache = createMemoryCache();
    await expect(cache.ping()).resolves.toBeUndefined();
  });
});
