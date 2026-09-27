import QuickLRU from "@alloc/quick-lru";
import type { Cache } from "@/cache/cache-types.js";
import {
  DEFAULT_MEMORY_CACHE_MAX_ITEMS,
  resolveMemoryCacheMaxItemsFromEnv,
  resolveMemoryCacheTtlSecondsFromEnv,
} from "@/constants/memory-cache.js";

export type MemoryCacheOptions = {
  /** Maximum number of entries before LRU eviction (default from env, else 5000). */
  maxItems?: number;
  /** Fallback TTL (seconds) for entries set without an explicit TTL. */
  defaultTtlSeconds?: number;
  /** Called when an entry is evicted (capacity or TTL). */
  onEviction?: (key: string, value: string) => void;
};

const MS_PER_SECOND = 1000 as const;

/**
 * In-memory LRU cache backed by `@alloc/quick-lru`. Entries expire lazily via
 * per-item TTLs; large caches evict the least-recently-used entries instead of
 * growing unbounded. Good for local dev, tests, and single-instance deployments.
 */
export function createMemoryCache(options: MemoryCacheOptions = {}): Cache {
  const maxItems =
    options.maxItems ?? resolveMemoryCacheMaxItemsFromEnv();
  const defaultTtlSeconds =
    options.defaultTtlSeconds ?? resolveMemoryCacheTtlSecondsFromEnv();

  const store = new QuickLRU<string, string>({
    maxSize: Math.max(1, maxItems),
    ...(options.onEviction === undefined
      ? {}
      : { onEviction: options.onEviction }),
  });

  function ttlMs(ttlSeconds: number): number {
    const seconds = ttlSeconds > 0 ? ttlSeconds : defaultTtlSeconds;
    return seconds * MS_PER_SECOND;
  }

  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      store.set(key, value, { maxAge: ttlMs(ttlSeconds) });
    },
    async del(key: string): Promise<void> {
      store.delete(key);
    },
    async ping(): Promise<void> {},
  };
}

export { DEFAULT_MEMORY_CACHE_MAX_ITEMS };
