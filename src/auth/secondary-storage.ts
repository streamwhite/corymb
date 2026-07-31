import type { Cache } from "@/cache/cache-types.js";

export type SecondaryStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

const FALLBACK_TTL_SECONDS = 60 * 60 * 24 * 7;

export function createSecondaryStorage(cache: Cache): SecondaryStorage {
  return {
    async get(key: string): Promise<string | null> {
      return cache.get(key);
    },
    async set(key: string, value: string, ttl?: number): Promise<void> {
      const ttlSeconds =
        ttl !== undefined && ttl > 0 ? ttl : FALLBACK_TTL_SECONDS;
      await cache.set(key, value, ttlSeconds);
    },
    async delete(key: string): Promise<void> {
      await cache.del(key);
    },
  };
}
