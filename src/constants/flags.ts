import { readBoolEnv, readEnv } from "@/config/env.js";
import { parsePositiveIntEnv } from "@/constants/env-int.js";

export const ENV_FEATURE_FLAGS = "FEATURE_FLAGS" as const;

export const FEATURE_FLAG_CACHE_KEY = "feature-flags" as const;

export const DEFAULT_FEATURE_FLAG_CACHE_TTL_SECONDS = 30 as const;

export const ENV_FEATURE_FLAG_CACHE_TTL_SECONDS =
  "FEATURE_FLAG_CACHE_TTL_SECONDS" as const;

export const ENV_FEATURE_FLAGS_REMOTE = "FEATURE_FLAGS_REMOTE" as const;

/** When true, flags are read through the cache before the local source. */
export function resolveFeatureFlagsRemoteFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readBoolEnv(ENV_FEATURE_FLAGS_REMOTE, false, env);
}

export function resolveFeatureFlagCacheTtlFromEnv(
  env: Record<string, string | undefined> = process.env,
): number {
  return parsePositiveIntEnv(
    readEnv(ENV_FEATURE_FLAG_CACHE_TTL_SECONDS, env),
    DEFAULT_FEATURE_FLAG_CACHE_TTL_SECONDS,
  );
}
