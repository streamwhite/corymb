import { RedisClient } from "bun";
import { RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";
import {
  RATE_LIMIT_DEFAULT_MAX,
  RATE_LIMIT_ENV_BY_STRATEGY,
  RATE_LIMIT_STRATEGY_RELAXED,
  RATE_LIMIT_STRATEGY_STANDARD,
  RATE_LIMIT_STRATEGY_STRICT,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitStrategy,
} from "@/constants/rate-limit.js";
import { consumeRedisCounter } from "@/http/rate-limit-redis.js";

const HEADER_X_FORWARDED_FOR = "x-forwarded-for" as const;
const HEADER_X_REAL_IP = "x-real-ip" as const;
const XFF_SEPARATOR = "," as const;
const RATE_UNKNOWN_CLIENT_KEY = "unknown" as const;
const MS_PER_SECOND = 1000 as const;
const RATE_LIMIT_KEY_PREFIX = "rl" as const;

/** Cost of a single request against the fixed window. */
const RATE_LIMIT_POINTS_PER_REQUEST = 1 as const;

/** Fixed window length in seconds, matching `RATE_LIMIT_WINDOW_MS`. */
const DURATION_SECONDS = Math.round(RATE_LIMIT_WINDOW_MS / MS_PER_SECOND);

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

type StrategyLimiter = (key: string) => Promise<RateLimitResult>;

export type RateLimitOptions = {
  /** Redis URL; when set, limits are shared atomically across replicas. */
  redisUrl?: string;
  /** Reuse an existing Bun Redis client (e.g. the cache client). */
  client?: RedisClient;
  /** Explicit per-strategy maxima (wins over env/defaults). */
  max?: Partial<Record<RateLimitStrategy, number>>;
  /** Per-strategy test override; when provided, ignores `max`/env. */
  overrideMax?: Partial<Record<RateLimitStrategy, number>>;
  /** Namespace for Redis keys (multiple apps on one Redis). */
  keyPrefix?: string;
};

export type RateLimiter = {
  check: (
    strategy: RateLimitStrategy,
    clientKey: string,
  ) => Promise<RateLimitResult>;
  close: () => void;
};

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function resolveStrategyMax(
  strategy: RateLimitStrategy,
  options: RateLimitOptions,
): number {
  return (
    options.overrideMax?.[strategy] ??
    options.max?.[strategy] ??
    parsePositiveInt(process.env[RATE_LIMIT_ENV_BY_STRATEGY[strategy]]) ??
    RATE_LIMIT_DEFAULT_MAX[strategy]
  );
}

function retryAfterFrom(msBeforeNext: number): number {
  return Math.max(1, Math.ceil(msBeforeNext / MS_PER_SECOND));
}

function toResult(res: RateLimiterRes): RateLimitResult {
  return { ok: true };
}

/** In-process limiter (single replica / tests) using the package's memory store. */
function createMemoryLimiter(
  strategy: RateLimitStrategy,
  options: RateLimitOptions,
): StrategyLimiter {
  const limiter = new RateLimiterMemory({
    keyPrefix: `${options.keyPrefix ?? RATE_LIMIT_KEY_PREFIX}:${strategy}`,
    points: resolveStrategyMax(strategy, options),
    duration: DURATION_SECONDS,
  });
  return async (key) => {
    try {
      return toResult(await limiter.consume(key));
    } catch (res) {
      if (res instanceof Error) throw res;
      return {
        ok: false,
        retryAfterSec: retryAfterFrom((res as RateLimiterRes).msBeforeNext),
      };
    }
  };
}

/** Redis-backed limiter: atomic fixed-window counters shared across replicas. */
function createRedisLimiter(
  strategy: RateLimitStrategy,
  options: RateLimitOptions,
  client: RedisClient,
): StrategyLimiter {
  const prefix = `${options.keyPrefix ?? RATE_LIMIT_KEY_PREFIX}:${strategy}`;
  const max = resolveStrategyMax(strategy, options);
  return async (key) => {
    const [consumed, ttlMs] = await consumeRedisCounter(
      client,
      `${prefix}:${key}`,
      RATE_LIMIT_POINTS_PER_REQUEST,
      DURATION_SECONDS,
    );
    if (consumed <= max) {
      return { ok: true };
    }
    return { ok: false, retryAfterSec: retryAfterFrom(ttlMs) };
  };
}

/**
 * Builds the per-strategy limiters with `rate-limiter-flexible`. A Redis client
 * makes counters atomic and shared; without one an in-memory limiter keeps
 * single-instance deploys and tests working.
 */
export function createRateLimiter(options: RateLimitOptions = {}): RateLimiter {
  const ownedClient =
    options.client === undefined && options.redisUrl !== undefined
      ? new RedisClient(options.redisUrl, { autoReconnect: true })
      : undefined;
  const client = options.client ?? ownedClient;
  const make = (strategy: RateLimitStrategy): StrategyLimiter =>
    client === undefined
      ? createMemoryLimiter(strategy, options)
      : createRedisLimiter(strategy, options, client);

  const limiters: Record<RateLimitStrategy, StrategyLimiter> = {
    [RATE_LIMIT_STRATEGY_STRICT]: make(RATE_LIMIT_STRATEGY_STRICT),
    [RATE_LIMIT_STRATEGY_STANDARD]: make(RATE_LIMIT_STRATEGY_STANDARD),
    [RATE_LIMIT_STRATEGY_RELAXED]: make(RATE_LIMIT_STRATEGY_RELAXED),
  };

  return {
    check: (strategy, clientKey) => limiters[strategy](clientKey),
    close: () => ownedClient?.close(),
  };
}

export function rateLimitClientKey(headers: Headers): string {
  const xff = headers.get(HEADER_X_FORWARDED_FOR);
  if (xff !== null && xff.length > 0) {
    const first = xff.split(XFF_SEPARATOR)[0]?.trim();
    if (first !== undefined && first.length > 0) {
      return first;
    }
  }
  const realIp = headers.get(HEADER_X_REAL_IP);
  if (realIp !== null && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return RATE_UNKNOWN_CLIENT_KEY;
}

