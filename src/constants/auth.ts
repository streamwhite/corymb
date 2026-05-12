import { resolveBcryptCostFromEnv } from "./bcrypt-cost.js";

/** Bearer scheme for `Authorization` (RFC 6750 style). */
export const AUTH_SCHEME_BEARER = "Bearer" as const;

export const AUTH_BEARER_HEADER_PREFIX = `${AUTH_SCHEME_BEARER} ` as const;

/** Short-lived HS256 JWT used as `Authorization: Bearer …` for protected calls. */
export const RESPONSE_FIELD_ACCESS_TOKEN = "accessToken" as const;

/** Long-lived opaque `<sessionId>.<secret>` posted to /auth/refresh + /auth/signout. */
export const RESPONSE_FIELD_REFRESH_TOKEN = "refreshToken" as const;

/** Browser auth UI stores the access token in `sessionStorage` under this key. */
export const AUTH_TOKEN_BROWSER_STORAGE_KEY =
  "hono-hands-on-access-token" as const;

/** Browser auth UI stores the refresh token in `sessionStorage` under this key. */
export const REFRESH_TOKEN_BROWSER_STORAGE_KEY =
  "hono-hands-on-refresh-token" as const;

/** Cookie max-age in seconds (7 days). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const BCRYPT_COST = resolveBcryptCostFromEnv();

export const MIN_PASSWORD_LENGTH = 8;

export const SESSION_TOKEN_BYTE_LENGTH = 32;

/** Regex: minimal valid email shape for basic auth. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
