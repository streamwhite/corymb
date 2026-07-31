const SECONDS_PER_MINUTE = 60 as const;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;
const SECONDS_PER_DAY = SECONDS_PER_HOUR * 24;

export const ENV_BETTER_AUTH_SECRET = "BETTER_AUTH_SECRET" as const;

export const ENV_BETTER_AUTH_URL = "BETTER_AUTH_URL" as const;

export const ENV_ACCESS_JWT_EXPIRATION = "ACCESS_JWT_EXPIRATION" as const;

export const ENV_SESSION_EXPIRES_IN_SECONDS =
  "SESSION_EXPIRES_IN_SECONDS" as const;

export const ENV_SESSION_UPDATE_AGE_SECONDS =
  "SESSION_UPDATE_AGE_SECONDS" as const;

export const ENV_COOKIE_CACHE_MAX_AGE_SECONDS =
  "COOKIE_CACHE_MAX_AGE_SECONDS" as const;

export const DEFAULT_BETTER_AUTH_URL = "http://localhost:3000" as const;

export const DEFAULT_ACCESS_JWT_EXPIRATION = "15m" as const;

export const DEFAULT_SESSION_EXPIRES_IN_SECONDS = SECONDS_PER_DAY * 7;

export const DEFAULT_SESSION_UPDATE_AGE_SECONDS = SECONDS_PER_DAY;

export const DEFAULT_COOKIE_CACHE_MAX_AGE_SECONDS = SECONDS_PER_MINUTE * 5;

export const BETTER_AUTH_BASE_PATH = "/api/auth" as const;

export const AUTH_SESSION_ROTATE_PATH =
  `${BETTER_AUTH_BASE_PATH}/session/rotate` as const;

/** Better Auth built-in: list active server-side sessions. */
export const AUTH_LIST_SESSIONS_PATH =
  `${BETTER_AUTH_BASE_PATH}/list-sessions` as const;

/** Better Auth built-in: revoke one session by token. */
export const AUTH_REVOKE_SESSION_PATH =
  `${BETTER_AUTH_BASE_PATH}/revoke-session` as const;

/** Better Auth built-in: revoke all sessions except current. */
export const AUTH_REVOKE_OTHER_SESSIONS_PATH =
  `${BETTER_AUTH_BASE_PATH}/revoke-other-sessions` as const;

export const MIN_BETTER_AUTH_SECRET_BYTES = 32 as const;

const LOCAL_DEV_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"] as const;

const LOCAL_DEV_SCHEMES = ["http", "https"] as const;

export function resolveBetterAuthUrlFromEnv(): string {
  const fromEnv = process.env[ENV_BETTER_AUTH_URL];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_BETTER_AUTH_URL;
}

/** Origins browsers may use in local TLS / bind-all setups. */
export function resolveTrustedOrigins(
  baseURL: string,
  isDevelopment: boolean,
): string[] {
  const origins = new Set<string>([baseURL]);
  if (!isDevelopment) {
    return Array.from(origins);
  }
  try {
    const url = new URL(baseURL);
    const port = url.port.length > 0 ? url.port : "";
    for (const scheme of LOCAL_DEV_SCHEMES) {
      for (const host of LOCAL_DEV_HOSTS) {
        const origin =
          port.length > 0
            ? `${scheme}://${host}:${port}`
            : `${scheme}://${host}`;
        origins.add(origin);
      }
    }
  } catch {
    // keep baseURL only
  }
  return Array.from(origins);
}

export function resolveAccessJwtExpirationFromEnv(): string {
  const fromEnv = process.env[ENV_ACCESS_JWT_EXPIRATION];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_ACCESS_JWT_EXPIRATION;
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

export function resolveSessionExpiresInSecondsFromEnv(): number {
  return parsePositiveInt(
    process.env[ENV_SESSION_EXPIRES_IN_SECONDS],
    DEFAULT_SESSION_EXPIRES_IN_SECONDS,
  );
}

export function resolveSessionUpdateAgeSecondsFromEnv(): number {
  return parsePositiveInt(
    process.env[ENV_SESSION_UPDATE_AGE_SECONDS],
    DEFAULT_SESSION_UPDATE_AGE_SECONDS,
  );
}

export function resolveCookieCacheMaxAgeSecondsFromEnv(): number {
  return parsePositiveInt(
    process.env[ENV_COOKIE_CACHE_MAX_AGE_SECONDS],
    DEFAULT_COOKIE_CACHE_MAX_AGE_SECONDS,
  );
}

export function resolveBetterAuthSecretFromEnv(): string {
  const raw = process.env[ENV_BETTER_AUTH_SECRET];
  if (raw !== undefined && raw.length >= MIN_BETTER_AUTH_SECRET_BYTES) {
    return raw;
  }
  const jwtFallback = process.env.JWT_SECRET;
  if (
    jwtFallback !== undefined &&
    jwtFallback.length >= MIN_BETTER_AUTH_SECRET_BYTES
  ) {
    return jwtFallback;
  }
  throw new Error(
    `${ENV_BETTER_AUTH_SECRET} (or JWT_SECRET) must be at least ${String(MIN_BETTER_AUTH_SECRET_BYTES)} characters`,
  );
}
