/** Rolling window for all rate-limit strategies (ms). */
export const RATE_LIMIT_WINDOW_MS = 60_000 as const;

export const RATE_LIMIT_STRATEGY_STRICT = "strict" as const;

export const RATE_LIMIT_STRATEGY_STANDARD = "standard" as const;

export const RATE_LIMIT_STRATEGY_RELAXED = "relaxed" as const;

export type RateLimitStrategy =
  | typeof RATE_LIMIT_STRATEGY_STRICT
  | typeof RATE_LIMIT_STRATEGY_STANDARD
  | typeof RATE_LIMIT_STRATEGY_RELAXED;

/** Default max requests per client per window for each strategy. */
export const RATE_LIMIT_DEFAULT_MAX: Record<RateLimitStrategy, number> = {
  [RATE_LIMIT_STRATEGY_STRICT]: 10,
  [RATE_LIMIT_STRATEGY_STANDARD]: 60,
  [RATE_LIMIT_STRATEGY_RELAXED]: 300,
};

export const ENV_RATE_LIMIT_STRICT_MAX = "RATE_LIMIT_STRICT_MAX" as const;

export const ENV_RATE_LIMIT_STANDARD_MAX = "RATE_LIMIT_STANDARD_MAX" as const;

export const ENV_RATE_LIMIT_RELAXED_MAX = "RATE_LIMIT_RELAXED_MAX" as const;

export const RATE_LIMIT_ENV_BY_STRATEGY: Record<RateLimitStrategy, string> = {
  [RATE_LIMIT_STRATEGY_STRICT]: ENV_RATE_LIMIT_STRICT_MAX,
  [RATE_LIMIT_STRATEGY_STANDARD]: ENV_RATE_LIMIT_STANDARD_MAX,
  [RATE_LIMIT_STRATEGY_RELAXED]: ENV_RATE_LIMIT_RELAXED_MAX,
};

export const ENV_RATE_LIMIT_KEY_PREFIX = "RATE_LIMIT_KEY_PREFIX" as const;

export const DEFAULT_RATE_LIMIT_KEY_PREFIX = "rl" as const;

/** Redis key namespace for rate-limit counters (shared Redis across apps). */
export function resolveRateLimitKeyPrefixFromEnv(): string {
  const fromEnv = process.env[ENV_RATE_LIMIT_KEY_PREFIX];
  return fromEnv !== undefined && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_RATE_LIMIT_KEY_PREFIX;
}
