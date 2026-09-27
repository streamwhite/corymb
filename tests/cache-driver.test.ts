import { describe, expect, it } from "bun:test";
import { createCacheBundle } from "@/cache/client.js";
import {
  CACHE_DRIVER_MEMORY,
  CACHE_DRIVER_REDIS,
  resolveCacheDriverFromEnv,
} from "@/constants/cache-driver.js";

const ENV_CACHE_DRIVER = "CACHE_DRIVER" as const;

describe("cache driver selection", () => {
  it("defaults to redis", () => {
    expect(resolveCacheDriverFromEnv({})).toBe(CACHE_DRIVER_REDIS);
    expect(resolveCacheDriverFromEnv({ [ENV_CACHE_DRIVER]: "redis" })).toBe(
      CACHE_DRIVER_REDIS,
    );
  });

  it("selects memory when CACHE_DRIVER=memory", () => {
    expect(
      resolveCacheDriverFromEnv({ [ENV_CACHE_DRIVER]: "memory" }),
    ).toBe(CACHE_DRIVER_MEMORY);
  });

  it("falls back to redis for unknown values", () => {
    expect(
      resolveCacheDriverFromEnv({ [ENV_CACHE_DRIVER]: "memcached" }),
    ).toBe(CACHE_DRIVER_REDIS);
  });

  it("builds a memory cache bundle without Redis", async () => {
    const bundle = await createCacheBundle({ driver: CACHE_DRIVER_MEMORY });
    try {
      await bundle.cache.set("k", "v", 60);
      expect(await bundle.cache.get("k")).toBe("v");
      await bundle.cache.ping();
    } finally {
      bundle.close();
    }
  });
});
