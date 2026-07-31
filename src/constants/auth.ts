import { resolveBcryptCostFromEnv } from "./bcrypt-cost.js";

/** Bearer scheme for `Authorization` (RFC 6750 style). */
export const AUTH_SCHEME_BEARER = "Bearer" as const;

export const AUTH_BEARER_HEADER_PREFIX = `${AUTH_SCHEME_BEARER} ` as const;

export const BCRYPT_COST = resolveBcryptCostFromEnv();

export const MIN_PASSWORD_LENGTH = 8;

/** Regex: minimal valid email shape for basic auth. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
