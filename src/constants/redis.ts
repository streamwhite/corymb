const SECONDS_PER_MINUTE = 60 as const;

export const ENV_REDIS_URL = "REDIS_URL" as const;

export const ENV_VALKEY_URL = "VALKEY_URL" as const;

export const ENV_CACHE_KEY_PREFIX = "CACHE_KEY_PREFIX" as const;

export const ENV_CACHE_USER_TTL_SECONDS = "CACHE_USER_TTL_SECONDS" as const;

export const ENV_CACHE_SESSION_TTL_SECONDS =
  "CACHE_SESSION_TTL_SECONDS" as const;

export const DEFAULT_REDIS_URL = "redis://localhost:6379" as const;

export const DEFAULT_CACHE_KEY_PREFIX = "bunjs-hands-on:" as const;

export const DEFAULT_CACHE_USER_TTL_SECONDS = SECONDS_PER_MINUTE * 5;

export const DEFAULT_CACHE_SESSION_TTL_SECONDS = SECONDS_PER_MINUTE * 5;

const MS_PER_SECOND = 1000 as const;

export function resolveCacheKeyPrefixFromEnv(): string {
  const fromEnv = process.env[ENV_CACHE_KEY_PREFIX];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_CACHE_KEY_PREFIX;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function resolveCacheUserTtlSecondsFromEnv(): number {
  return parsePositiveInt(
    process.env[ENV_CACHE_USER_TTL_SECONDS],
    DEFAULT_CACHE_USER_TTL_SECONDS,
  );
}

export function resolveCacheSessionTtlSecondsFromEnv(): number {
  return parsePositiveInt(
    process.env[ENV_CACHE_SESSION_TTL_SECONDS],
    DEFAULT_CACHE_SESSION_TTL_SECONDS,
  );
}

export function resolveRedisUrlFromEnv(): string {
  const redisUrl = process.env[ENV_REDIS_URL];
  if (redisUrl !== undefined && redisUrl.length > 0) {
    return redisUrl;
  }
  const valkeyUrl = process.env[ENV_VALKEY_URL];
  if (valkeyUrl !== undefined && valkeyUrl.length > 0) {
    return valkeyUrl;
  }
  return DEFAULT_REDIS_URL;
}

/** TTL capped by remaining lifetime until `expiresAt` (ISO string). */
export function ttlSecondsUntilExpiry(
  expiresAt: string,
  capSeconds: number,
): number {
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) {
    return capSeconds;
  }
  const remainingSeconds = Math.ceil(
    (expiresMs - Date.now()) / MS_PER_SECOND,
  );
  if (remainingSeconds <= 0) {
    return 1;
  }
  return Math.min(remainingSeconds, capSeconds);
}
