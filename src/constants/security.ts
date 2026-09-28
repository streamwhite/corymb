import { parsePositiveIntEnv } from "@/constants/env-int.js";

export const HEADER_X_REQUESTED_WITH = "X-Requested-With" as const;

export const HEADER_ORIGIN = "Origin" as const;

export const HEADER_HOST = "Host" as const;

export const HEADER_X_FORWARDED_HOST = "X-Forwarded-Host" as const;

export const HEADER_X_FORWARDED_PROTO = "X-Forwarded-Proto" as const;

/** Timeout applied to route handlers by the request-timeout middleware (ms). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export const ENV_REQUEST_TIMEOUT_MS = "REQUEST_TIMEOUT_MS" as const;

/** Max URL/query length accepted (chars). */
export const DEFAULT_MAX_URL_LENGTH = 2048 as const;

export const ENV_MAX_URL_LENGTH = "MAX_URL_LENGTH" as const;

/** CSRF token lifetime (seconds). */
export const DEFAULT_CSRF_TTL_SECONDS = 60 * 60 * 24;

export const ENV_CSRF_TTL_SECONDS = "CSRF_TTL_SECONDS" as const;

export const CSRF_TOKEN_BYTES = 32 as const;

export const CSRF_COOKIE_NAME = "csrf_token" as const;

export const CSRF_HEADER_NAME = "x-csrf-token" as const;

export const CSRF_SAFE_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

/** Brute-force lockout defaults (per key). */
export const DEFAULT_BRUTE_FORCE_MAX_ATTEMPTS = 5 as const;

export const DEFAULT_BRUTE_FORCE_WINDOW_SECONDS = 15 * 60;

export const DEFAULT_BRUTE_FORCE_LOCK_SECONDS = 15 * 60;

export const ENV_BRUTE_FORCE_MAX_ATTEMPTS = "BRUTE_FORCE_MAX_ATTEMPTS" as const;

export const ENV_BRUTE_FORCE_WINDOW_SECONDS =
  "BRUTE_FORCE_WINDOW_SECONDS" as const;

export const ENV_BRUTE_FORCE_LOCK_SECONDS = "BRUTE_FORCE_LOCK_SECONDS" as const;

export const DEFAULT_BRUTE_FORCE_KEY_PREFIX = "bf" as const;

/** Resolves the request timeout from `REQUEST_TIMEOUT_MS` or the default. */
export function resolveRequestTimeoutMsFromEnv(
  env: Record<string, string | undefined> = process.env,
): number {
  return parsePositiveIntEnv(env[ENV_REQUEST_TIMEOUT_MS], DEFAULT_REQUEST_TIMEOUT_MS);
}

/** Resolves the max request URL length from `MAX_URL_LENGTH` or the default. */
export function resolveMaxUrlLengthFromEnv(
  env: Record<string, string | undefined> = process.env,
): number {
  return parsePositiveIntEnv(env[ENV_MAX_URL_LENGTH], DEFAULT_MAX_URL_LENGTH);
}

/** Resolves CSRF token lifetime from `CSRF_TTL_SECONDS` or the default. */
export function resolveCsrfTtlSecondsFromEnv(
  env: Record<string, string | undefined> = process.env,
): number {
  return parsePositiveIntEnv(env[ENV_CSRF_TTL_SECONDS], DEFAULT_CSRF_TTL_SECONDS);
}

/** Brute-force thresholds resolved from env with defaults. */
export function resolveBruteForceConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): {
  maxAttempts: number;
  windowSeconds: number;
  lockSeconds: number;
} {
  return {
    maxAttempts: parsePositiveIntEnv(
      env[ENV_BRUTE_FORCE_MAX_ATTEMPTS],
      DEFAULT_BRUTE_FORCE_MAX_ATTEMPTS,
    ),
    windowSeconds: parsePositiveIntEnv(
      env[ENV_BRUTE_FORCE_WINDOW_SECONDS],
      DEFAULT_BRUTE_FORCE_WINDOW_SECONDS,
    ),
    lockSeconds: parsePositiveIntEnv(
      env[ENV_BRUTE_FORCE_LOCK_SECONDS],
      DEFAULT_BRUTE_FORCE_LOCK_SECONDS,
    ),
  };
}
