/** Parse a positive integer env value; fall back when unset/invalid/non-positive. */
export function parsePositiveIntEnv(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || raw.length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
