import type { CacheBundle } from "@/cache/cache-types.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { createRedisCacheBundle } from "@/cache/redis-cache.js";
import {
  CACHE_DRIVER_MEMORY,
  type CacheDriver,
  resolveCacheDriverFromEnv,
} from "@/constants/cache-driver.js";
import { resolveRedisUrlFromEnv } from "@/constants/redis.js";

export type CacheOptions = {
  redisUrl?: string;
  /** Cache backend; defaults to `CACHE_DRIVER` env (redis unless set to memory). */
  driver?: CacheDriver;
};

/** Builds a cache bundle for the selected driver (Redis by default). */
export async function createCacheBundle(
  options?: CacheOptions,
): Promise<CacheBundle> {
  const driver = options?.driver ?? resolveCacheDriverFromEnv();
  if (driver === CACHE_DRIVER_MEMORY) {
    return { cache: createMemoryCache(), close: () => {} };
  }
  const url = options?.redisUrl ?? resolveRedisUrlFromEnv();
  return createRedisCacheBundle({ url });
}

export function closeCacheBundle(bundle: CacheBundle): void {
  bundle.close();
}
