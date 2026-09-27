export const ENV_SHUTDOWN_TIMEOUT_MS = "SHUTDOWN_TIMEOUT_MS" as const;

/** How long to wait for in-flight work before forcing exit (ms). */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

/** Exit code used when shutdown exceeds its deadline. */
export const SHUTDOWN_TIMEOUT_EXIT_CODE = 1;

const MS_PER_SECOND = 1000;

export function resolveShutdownTimeoutMs(): number {
  const raw = process.env[ENV_SHUTDOWN_TIMEOUT_MS];
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_SHUTDOWN_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SHUTDOWN_TIMEOUT_MS;
}

export function secondsToMs(seconds: number): number {
  return seconds * MS_PER_SECOND;
}
