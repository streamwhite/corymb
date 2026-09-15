import { RedisClient } from "bun";
import type { Cache, CacheBundle } from "@/cache/cache-types.js";

export type RedisCacheOptions = {
  url: string;
};

const REDIS_PROBE_TIMEOUT_MS = 1000;

function logCacheError(operation: string, err: unknown): void {
  console.error(`[cache] ${operation} failed:`, err);
}

/** Rejects if the promise does not settle within REDIS_PROBE_TIMEOUT_MS. */
function withTimeout<T>(task: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Redis cache probe timed out"));
    }, REDIS_PROBE_TIMEOUT_MS);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function redisCacheReachable(url: string): Promise<boolean> {
  const probe = new RedisClient(url, {
    connectionTimeout: REDIS_PROBE_TIMEOUT_MS,
  });
  try {
    const reply = await withTimeout(probe.send("PING", []));
    return reply === "PONG";
  } catch {
    return false;
  } finally {
    probe.close();
  }
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
  if (!(await redisCacheReachable(options.url))) {
    throw new Error(
      `Redis cache is unreachable at ${options.url}. Start Redis or set REDIS_URL to a reachable instance.`,
    );
  }
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
