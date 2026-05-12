import {
  RATE_LIMIT_DEFAULT_MAX,
  RATE_LIMIT_ENV_BY_STRATEGY,
  RATE_LIMIT_STRATEGY_RELAXED,
  RATE_LIMIT_STRATEGY_STANDARD,
  RATE_LIMIT_STRATEGY_STRICT,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitStrategy,
} from "@/constants/rate-limit.js";

const RADIX_DECIMAL = 10 as const;

const HEADER_X_FORWARDED_FOR = "x-forwarded-for" as const;

const HEADER_X_REAL_IP = "x-real-ip" as const;

const RATE_UNKNOWN_CLIENT_KEY = "unknown" as const;

const XFF_SEPARATOR = "," as const;

const MS_PER_SECOND = 1000 as const;

type WindowBucket = { windowStart: number; count: number };

type StrategyState = {
  buckets: Map<string, WindowBucket>;
  testOverride?: number;
};

function emptyState(): StrategyState {
  return { buckets: new Map() };
}

const strategies: Record<RateLimitStrategy, StrategyState> = {
  [RATE_LIMIT_STRATEGY_STRICT]: emptyState(),
  [RATE_LIMIT_STRATEGY_STANDARD]: emptyState(),
  [RATE_LIMIT_STRATEGY_RELAXED]: emptyState(),
};

export function setRateLimitMaxOverrideForTests(
  strategy: RateLimitStrategy,
  max: number | undefined,
): void {
  strategies[strategy].testOverride = max;
}

/** Test-only: clear all per-strategy bucket state + overrides between tests. */
export function resetRateLimitStateForTests(): void {
  for (const strategy of Object.keys(strategies) as RateLimitStrategy[]) {
    strategies[strategy].buckets.clear();
    strategies[strategy].testOverride = undefined;
  }
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  const n = Number.parseInt(raw, RADIX_DECIMAL);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function resolveStrategyMax(strategy: RateLimitStrategy): number {
  const state = strategies[strategy];
  if (state.testOverride !== undefined) {
    return state.testOverride;
  }
  const fromEnv = parsePositiveInt(
    process.env[RATE_LIMIT_ENV_BY_STRATEGY[strategy]],
  );
  return fromEnv ?? RATE_LIMIT_DEFAULT_MAX[strategy];
}

function pruneExpiredBuckets(state: StrategyState, now: number): void {
  const cutoff = now - 2 * RATE_LIMIT_WINDOW_MS;
  for (const [key, b] of state.buckets) {
    if (b.windowStart < cutoff) {
      state.buckets.delete(key);
    }
  }
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

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export function takeRateLimitSlot(
  strategy: RateLimitStrategy,
  clientKey: string,
): RateLimitResult {
  const state = strategies[strategy];
  const now = Date.now();
  pruneExpiredBuckets(state, now);
  const max = resolveStrategyMax(strategy);
  const b = state.buckets.get(clientKey);
  if (b === undefined || now - b.windowStart >= RATE_LIMIT_WINDOW_MS) {
    state.buckets.set(clientKey, { windowStart: now, count: 1 });
    return { ok: true };
  }
  if (b.count < max) {
    b.count += 1;
    return { ok: true };
  }
  const retryAfterMs = b.windowStart + RATE_LIMIT_WINDOW_MS - now;
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / MS_PER_SECOND));
  return { ok: false, retryAfterSec };
}
