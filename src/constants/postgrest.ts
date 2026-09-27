import { readEnv, readEnvOrThrow } from "@/config/env.js";
import { APP_DB_SCHEMA } from "@/constants/database.js";
import { parsePositiveIntEnv } from "@/constants/env-int.js";

export const ENV_POSTGREST_URL = "POSTGREST_URL" as const;

export const ENV_POSTGREST_SCHEMA = "POSTGREST_SCHEMA" as const;

export const ENV_POSTGREST_SERVICE_TOKEN = "POSTGREST_SERVICE_TOKEN" as const;

export const ENV_POSTGREST_TIMEOUT_MS = "POSTGREST_TIMEOUT_MS" as const;

export const DEFAULT_POSTGREST_TIMEOUT_MS = 10_000;

export const POSTGREST_AUTHORIZATION_HEADER = "Authorization" as const;

export const POSTGREST_BEARER_PREFIX = "Bearer " as const;

export const POSTGREST_COUNT_HEADER = "Prefer" as const;

export type PostgrestConfig = {
  url: string;
  schema: string;
  serviceToken?: string;
  timeoutMs: number;
};

function assertHttpUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocol");
    }
    return url.replace(/\/+$/, "");
  } catch {
    throw new Error(`${ENV_POSTGREST_URL} must be an http(s) URL, got: ${url}`);
  }
}

export function resolvePostgrestUrlFromEnv(): string {
  return assertHttpUrl(readEnvOrThrow(ENV_POSTGREST_URL));
}

export function resolvePostgrestConfigFromEnv(): PostgrestConfig {
  return {
    url: resolvePostgrestUrlFromEnv(),
    schema: readEnv(ENV_POSTGREST_SCHEMA) ?? APP_DB_SCHEMA,
    serviceToken: readEnv(ENV_POSTGREST_SERVICE_TOKEN),
    timeoutMs: parsePositiveIntEnv(
      process.env[ENV_POSTGREST_TIMEOUT_MS],
      DEFAULT_POSTGREST_TIMEOUT_MS,
    ),
  };
}
