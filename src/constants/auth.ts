import { resolveBcryptCostFromEnv } from "./bcrypt-cost.js";

export const SESSION_COOKIE_NAME = "session" as const;

/** Cookie max-age in seconds (7 days). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const BCRYPT_COST = resolveBcryptCostFromEnv();

export const MIN_PASSWORD_LENGTH = 8;

export const SESSION_TOKEN_BYTE_LENGTH = 32;

/** Regex: minimal valid email shape for basic auth. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
