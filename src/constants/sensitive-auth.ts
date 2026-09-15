import { parsePositiveIntEnv } from "@/constants/env-int.js";

export const ENV_SENSITIVE_VERIFY_TTL_SECONDS =
  "SENSITIVE_VERIFY_TTL_SECONDS" as const;

const SECONDS_PER_MINUTE = 60 as const;

/** How long an explicit re-authentication stays valid (seconds). */
export const DEFAULT_SENSITIVE_VERIFY_TTL_SECONDS = SECONDS_PER_MINUTE * 5;

/** Cache key prefix for recently verified sessions. */
export const SENSITIVE_VERIFY_CACHE_PREFIX = "sensitive-verify:" as const;

/** Error code returned when a sensitive operation needs re-authentication. */
export const SENSITIVE_VERIFICATION_REQUIRED_CODE =
  "SENSITIVE_VERIFICATION_REQUIRED" as const;

export function resolveSensitiveVerifyTtlSecondsFromEnv(): number {
  return parsePositiveIntEnv(
    process.env[ENV_SENSITIVE_VERIFY_TTL_SECONDS],
    DEFAULT_SENSITIVE_VERIFY_TTL_SECONDS,
  );
}
