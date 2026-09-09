import { RedisClient } from "bun";
import {
  type EventBus,
  createMemoryEventBus,
} from "@/realtime/event-bus.js";

export type RedisEventBusOptions = {
  url: string;
};

const REDIS_PROBE_TIMEOUT_MS = 1000;

function logBusError(operation: string, err: unknown): void {
  console.error(`[events] redis ${operation} failed:`, err);
}

/**
 * Redis pub/sub bus. One subscriber connection multiplexes all local
 * handlers (a subscribed Redis client can only SUBSCRIBE/UNSUBSCRIBE/PING,
 * so publishing uses a separate connection). Channels are ref-counted and
 * unsubscribed on Redis once the last local handler goes away.
 */
export async function createRedisEventBus(
  options: RedisEventBusOptions,
): Promise<EventBus> {
  const subscriber = new RedisClient(options.url, { autoReconnect: true });
  const publisher = new RedisClient(options.url, {
    autoReconnect: true,
    enableAutoPipelining: true,
  });
  const handlers = new Map<string, Set<(message: string) => void>>();
  const redisRefs = new Map<string, number>();

  async function ensureRedisSubscribed(channel: string): Promise<void> {
    const refs = redisRefs.get(channel) ?? 0;
    redisRefs.set(channel, refs + 1);
    if (refs === 0) {
      try {
        await subscriber.subscribe(channel, (message) => {
          for (const handler of handlers.get(channel) ?? []) {
            try {
              handler(message);
            } catch (err) {
              logBusError("handler", err);
            }
          }
        });
      } catch (err) {
        redisRefs.set(channel, refs);
        logBusError(`subscribe ${channel}`, err);
        throw err;
      }
    }
  }

  async function maybeRedisUnsubscribe(channel: string): Promise<void> {
    const refs = redisRefs.get(channel) ?? 0;
    if (refs <= 1) {
      redisRefs.delete(channel);
      try {
        await subscriber.unsubscribe(channel);
      } catch (err) {
        logBusError(`unsubscribe ${channel}`, err);
      }
      return;
    }
    redisRefs.set(channel, refs - 1);
  }

  return {
    async publish(channel, message) {
      try {
        await publisher.publish(channel, message);
      } catch (err) {
        logBusError(`publish ${channel}`, err);
      }
    },
    async subscribe(channel, handler) {
      const set = handlers.get(channel) ?? new Set();
      set.add(handler);
      handlers.set(channel, set);
      await ensureRedisSubscribed(channel);
      return async () => {
        set.delete(handler);
        if (set.size === 0) {
          handlers.delete(channel);
          await maybeRedisUnsubscribe(channel);
        }
      };
    },
    async close() {
      handlers.clear();
      redisRefs.clear();
      publisher.close();
      subscriber.close();
    },
  };
}

/**
 * Default bus for the app: Redis-backed, falling back to the in-memory bus
 * when Redis is unreachable so the app still starts (single-instance mode).
 */
export async function createDefaultEventBus(
  options: RedisEventBusOptions,
): Promise<{ bus: EventBus; redis: boolean }> {
  if (!(await redisReachableCached(options.url))) {
    console.warn("[events] redis unreachable, using in-memory event bus");
    return { bus: createMemoryEventBus(), redis: false };
  }
  const bus = await createRedisEventBus(options);
  return { bus, redis: true };
}

/** Returns a stable guard so a single heavy startup check isn't repeated per app/test. */
let reachabilityCache: { url: string; reachable: boolean } | null = null;

async function redisReachableCached(url: string): Promise<boolean> {
  if (reachabilityCache !== null && reachabilityCache.url === url) {
    return reachabilityCache.reachable;
  }
  const reachable = await redisReachable(url);
  reachabilityCache = { url, reachable };
  return reachable;
}

async function redisReachable(url: string): Promise<boolean> {
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

/** Rejects if the promise does not settle within REDIS_PROBE_TIMEOUT_MS. */
function withTimeout<T>(task: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("redis probe timed out"));
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
