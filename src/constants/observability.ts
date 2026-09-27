export const HEADER_REQUEST_ID = "x-request-id" as const;

export const ENV_LOG_LEVEL = "LOG_LEVEL" as const;

export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVEL_DEBUG: LogLevel = "debug";
export const LOG_LEVEL_INFO: LogLevel = "info";
export const LOG_LEVEL_WARN: LogLevel = "warn";
export const LOG_LEVEL_ERROR: LogLevel = "error";

export const DEFAULT_LOG_LEVEL: LogLevel = LOG_LEVEL_INFO;

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function isLogLevel(value: string): value is LogLevel {
  return value in LOG_LEVEL_WEIGHT;
}

export function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
  return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[threshold];
}

/** Keys whose values are redacted from structured logs. */
export const REDACTED_LOG_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "token",
  "accessToken",
  "refreshToken",
  "password",
  "secret",
] as const;
