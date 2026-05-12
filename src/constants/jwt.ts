/** HS256 access-token algorithm header value (base64url JSON). */
export const JWT_ALG_HS256 = "HS256" as const;

export const JWT_TYP = "JWT" as const;

/** Issuer claim — server identity for self-issued access tokens. */
export const JWT_ISSUER = "hono-hands-on" as const;

/** Access token TTL (15 minutes). Refresh token in `sessions` is the long-lived one. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;

/** Min secret bytes (HS256 recommends 32B / 256-bit). */
export const JWT_MIN_SECRET_BYTES = 32 as const;

/** Generated dev/test fallback secret length. */
export const JWT_RANDOM_SECRET_BYTES = 48 as const;

export const ENV_JWT_SECRET = "JWT_SECRET" as const;

/** Authorization Bearer scheme is shared with refresh-flavoured tokens; access tokens use the same scheme. */
export const JWT_HEADER_PART_SEPARATOR = "." as const;
