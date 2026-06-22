import type { CacheBundle } from "@/cache/cache-types.js";
import { createRedisCacheBundle } from "@/cache/redis-cache.js";
import { resolveRedisUrlFromEnv } from "@/constants/redis.js";

export type CacheOptions = {
  redisUrl?: string;
};

export async function createCacheBundle(
  options?: CacheOptions,
): Promise<CacheBundle> {
  const url = options?.redisUrl ?? resolveRedisUrlFromEnv();
  return createRedisCacheBundle({ url });
}

export function closeCacheBundle(bundle: CacheBundle): void {
  bundle.close();
}
