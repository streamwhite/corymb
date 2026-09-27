import { readEnv } from "@/config/env.js";

export const CACHE_DRIVER_REDIS = "redis" as const;
export const CACHE_DRIVER_MEMORY = "memory" as const;

export type CacheDriver =
  | typeof CACHE_DRIVER_REDIS
  | typeof CACHE_DRIVER_MEMORY;

export const ENV_CACHE_DRIVER = "CACHE_DRIVER" as const;

export const DEFAULT_CACHE_DRIVER: CacheDriver = CACHE_DRIVER_REDIS;

/** Resolves the cache backend from `CACHE_DRIVER` (redis by default). */
export function resolveCacheDriverFromEnv(
  env: Record<string, string | undefined> = process.env,
): CacheDriver {
  const raw = readEnv(ENV_CACHE_DRIVER, env)?.toLowerCase();
  return raw === CACHE_DRIVER_MEMORY ? CACHE_DRIVER_MEMORY : DEFAULT_CACHE_DRIVER;
}
