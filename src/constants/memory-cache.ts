import { parsePositiveIntEnv } from "@/constants/env-int.js";

/** In-memory (LRU) cache tuning. */
export const ENV_MEMORY_CACHE_MAX_ITEMS = "MEMORY_CACHE_MAX_ITEMS" as const;

export const ENV_MEMORY_CACHE_TTL_SECONDS =
  "MEMORY_CACHE_TTL_SECONDS" as const;

export const DEFAULT_MEMORY_CACHE_MAX_ITEMS = 5000 as const;

/**
 * Fallback TTL for entries whose caller does not specify one. Cache `set` always
 * passes a TTL, so this only bounds unknown/expired entries.
 */
export const DEFAULT_MEMORY_CACHE_TTL_SECONDS = 300 as const;

export function resolveMemoryCacheMaxItemsFromEnv(): number {
  return parsePositiveIntEnv(
    process.env[ENV_MEMORY_CACHE_MAX_ITEMS],
    DEFAULT_MEMORY_CACHE_MAX_ITEMS,
  );
}

export function resolveMemoryCacheTtlSecondsFromEnv(): number {
  return parsePositiveIntEnv(
    process.env[ENV_MEMORY_CACHE_TTL_SECONDS],
    DEFAULT_MEMORY_CACHE_TTL_SECONDS,
  );
}
