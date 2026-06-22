import { RedisClient } from "bun";
import type { Cache, CacheBundle } from "@/cache/cache-types.js";

export type RedisCacheOptions = {
  url: string;
};

function logCacheError(operation: string, err: unknown): void {
  console.error(`[cache] ${operation} failed:`, err);
}

export function createRedisCache(client: RedisClient): Cache {
  return {
    async get(key: string): Promise<string | null> {
      try {
        return await client.get(key);
      } catch (err) {
        logCacheError(`get ${key}`, err);
        return null;
      }
    },

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      try {
        await client.set(key, value, "EX", String(ttlSeconds));
      } catch (err) {
        logCacheError(`set ${key}`, err);
      }
    },

    async del(key: string): Promise<void> {
      try {
        await client.del(key);
      } catch (err) {
        logCacheError(`del ${key}`, err);
      }
    },

    async ping(): Promise<void> {
      const reply = await client.send("PING", []);
      if (reply !== "PONG") {
        throw new Error(`Redis PING unexpected reply: ${String(reply)}`);
      }
    },
  };
}

export async function createRedisCacheBundle(
  options: RedisCacheOptions,
): Promise<CacheBundle> {
  const client = new RedisClient(options.url, {
    autoReconnect: true,
    enableAutoPipelining: true,
  });
  const cache = createRedisCache(client);
  await cache.ping();
  return {
    cache,
    close: () => {
      client.close();
    },
  };
}
