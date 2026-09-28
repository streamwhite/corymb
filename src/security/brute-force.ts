import { RedisClient } from "bun";
import { HEADER_RETRY_AFTER } from "@/constants/http-security.js";
import { HTTP_STATUS_TOO_MANY_REQUESTS } from "@/constants/http-status.js";
import { MSG_BRUTE_FORCE_LOCKED } from "@/constants/messages.js";
import {
  DEFAULT_BRUTE_FORCE_KEY_PREFIX,
  resolveBruteForceConfigFromEnv,
} from "@/constants/security.js";
import { jsonApiResponse } from "@/http/json-response.js";
import { rateLimitClientKey } from "@/http/rate-limit.js";
import { consumeRedisCounter } from "@/http/rate-limit-redis.js";
import type { Middleware } from "@/middleware/middleware-types.js";

const MS_PER_SECOND = 1000 as const;

const DEFAULT_FAILURE_STATUSES = [401, 403] as const;

type BruteForceStore = {
  increment: (key: string, windowSeconds: number) => Promise<number>;
  lock: (key: string, seconds: number) => Promise<void>;
  lockedFor: (key: string) => Promise<number>;
  reset: (key: string) => Promise<void>;
  close: () => void;
};

type CounterEntry = { count: number; resetAt: number };

function createMemoryStore(): BruteForceStore {
  const counters = new Map<string, CounterEntry>();
  const locks = new Map<string, number>();
  return {
    async increment(key, windowSeconds) {
      const now = Date.now();
      const existing = counters.get(key);
      const entry: CounterEntry =
        existing === undefined || existing.resetAt <= now
          ? { count: 1, resetAt: now + windowSeconds * MS_PER_SECOND }
          : { count: existing.count + 1, resetAt: existing.resetAt };
      counters.set(key, entry);
      return entry.count;
    },
    async lock(key, seconds) {
      locks.set(key, Date.now() + seconds * MS_PER_SECOND);
    },
    async lockedFor(key) {
      const expiry = locks.get(key);
      if (expiry === undefined) {
        return 0;
      }
      const remainingMs = expiry - Date.now();
      if (remainingMs <= 0) {
        locks.delete(key);
        return 0;
      }
      return Math.ceil(remainingMs / MS_PER_SECOND);
    },
    async reset(key) {
      counters.delete(key);
      locks.delete(key);
    },
    close() {},
  };
}

function counterKey(prefix: string, key: string): string {
  return `${prefix}:c:${key}`;
}

function lockKey(prefix: string, key: string): string {
  return `${prefix}:l:${key}`;
}

function toSeconds(raw: unknown): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function createRedisStore(
  client: RedisClient,
  prefix: string,
  owned: boolean,
): BruteForceStore {
  return {
    async increment(key, windowSeconds) {
      const [consumed] = await consumeRedisCounter(
        client,
        counterKey(prefix, key),
        1,
        windowSeconds,
      );
      return consumed;
    },
    async lock(key, seconds) {
      await client.send("SET", [lockKey(prefix, key), "1", "EX", String(seconds)]);
    },
    async lockedFor(key) {
      return toSeconds(await client.send("TTL", [lockKey(prefix, key)]));
    },
    async reset(key) {
      await client.send("DEL", [counterKey(prefix, key), lockKey(prefix, key)]);
    },
    close() {
      if (owned) client.close();
    },
  };
}

export type BruteForceCheck = { locked: boolean; retryAfterSec: number };

export type CreateBruteForceGuardOptions = {
  /** Failed attempts before lockout (default from `BRUTE_FORCE_MAX_ATTEMPTS`). */
  maxAttempts?: number;
  /** Window over which failures accumulate (default from env). */
  windowSeconds?: number;
  /** Lockout duration once the threshold is reached (default from env). */
  lockSeconds?: number;
  /** Redis URL; when set, state is shared across replicas. */
  redisUrl?: string;
  /** Reuse an existing Bun Redis client (e.g. the cache client). */
  client?: RedisClient;
  /** Redis key namespace (multiple apps on one Redis). */
  keyPrefix?: string;
};

export type BruteForceGuard = {
  check: (key: string) => Promise<BruteForceCheck>;
  recordFailure: (key: string) => Promise<void>;
  reset: (key: string) => Promise<void>;
  close: () => void;
};

/**
 * Tracks failed attempts per key and locks the key once the threshold is hit.
 * Uses Redis when configured, else an in-process store (single instance/tests).
 */
export function createBruteForceGuard(
  options: CreateBruteForceGuardOptions = {},
): BruteForceGuard {
  const config = resolveBruteForceConfigFromEnv();
  const maxAttempts = options.maxAttempts ?? config.maxAttempts;
  const windowSeconds = options.windowSeconds ?? config.windowSeconds;
  const lockSeconds = options.lockSeconds ?? config.lockSeconds;
  const prefix = options.keyPrefix ?? DEFAULT_BRUTE_FORCE_KEY_PREFIX;
  const client =
    options.client ??
    (options.redisUrl === undefined
      ? undefined
      : new RedisClient(options.redisUrl, { autoReconnect: true }));
  const owned = options.client === undefined && client !== undefined;
  const store =
    client === undefined
      ? createMemoryStore()
      : createRedisStore(client, prefix, owned);

  return {
    async check(key) {
      const retryAfterSec = await store.lockedFor(key);
      return retryAfterSec > 0
        ? { locked: true, retryAfterSec }
        : { locked: false, retryAfterSec: 0 };
    },
    async recordFailure(key) {
      const count = await store.increment(key, windowSeconds);
      if (count >= maxAttempts) {
        await store.lock(key, lockSeconds);
      }
    },
    reset: (key) => store.reset(key),
    close: () => store.close(),
  };
}

export type BruteForceMiddlewareOptions = {
  /** Derives the lockout key; defaults to the client IP. */
  keyFn?: (req: Request) => string;
  /** Response statuses counted as failures (default 401/403). */
  failureStatuses?: readonly number[];
};

export type BruteForceOptions = CreateBruteForceGuardOptions &
  BruteForceMiddlewareOptions;

function lockedResponse(req: Request, retryAfterSec: number): Response {
  return jsonApiResponse(
    { error: MSG_BRUTE_FORCE_LOCKED },
    {
      status: HTTP_STATUS_TOO_MANY_REQUESTS,
      headers: { [HEADER_RETRY_AFTER]: String(retryAfterSec) },
    },
    new URL(req.url),
  );
}

/**
 * Blocks locked keys and records failures. Access is reset after a success.
 * Apply to credential endpoints (sign-in, OTP, password reset, ...).
 */
export function withBruteForce(
  guard: BruteForceGuard,
  options: BruteForceMiddlewareOptions = {},
): Middleware {
  const keyFn = options.keyFn ?? ((req: Request) => rateLimitClientKey(req.headers));
  const failureStatuses = options.failureStatuses ?? DEFAULT_FAILURE_STATUSES;

  return async (ctx, next) => {
    const key = keyFn(ctx.req);
    const status = await guard.check(key);
    if (status.locked) {
      return lockedResponse(ctx.req, status.retryAfterSec);
    }
    const res = await next();
    if (failureStatuses.includes(res.status)) {
      await guard.recordFailure(key);
    } else if (res.status < 400) {
      await guard.reset(key);
    }
    return res;
  };
}
