import type { Cache } from "@/cache/cache-types.js";

export function createMemoryCache(): Cache {
  const store = new Map<string, { value: string; expiresAt: number | null }>();

  function isExpired(entry: { expiresAt: number | null }): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  return {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (entry === undefined) {
        return null;
      }
      if (isExpired(entry)) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      const expiresAt =
        ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    async del(key: string): Promise<void> {
      store.delete(key);
    },
    async ping(): Promise<void> {},
  };
}
