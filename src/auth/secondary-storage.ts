import type { Cache } from "@/cache/cache-types.js";

export type SecondaryStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  /** Required by better-auth 1.7+. */
  getAndDelete: (key: string) => Promise<string | null>;
  /** Required by better-auth 1.7+. Read-modify-write (not atomic — only used by rate limiter, not enabled here). */
  increment: (key: string) => Promise<number>;
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
    async getAndDelete(key: string): Promise<string | null> {
      const value = await cache.get(key);
      if (value !== null) await cache.del(key);
      return value;
    },
    async increment(key: string): Promise<number> {
      const raw = await cache.get(key);
      const next = (raw === null ? 0 : Number.parseInt(raw, 10) || 0) + 1;
      await cache.set(key, String(next), FALLBACK_TTL_SECONDS);
      return next;
    },
  };
}
