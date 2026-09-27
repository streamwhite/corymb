/** Typed readers for environment variables with explicit fallbacks. */

export function readEnv(
  key: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = env[key];
  return raw !== undefined && raw.length > 0 ? raw : undefined;
}

export function readEnvOrThrow(
  key: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const value = readEnv(key, env);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function readBoolEnv(
  key: string,
  fallback: boolean,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = readEnv(key, env)?.toLowerCase();
  if (raw === undefined) {
    return fallback;
  }
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

export function readListEnv(
  key: string,
  fallback: readonly string[] = [],
  env: Record<string, string | undefined> = process.env,
): string[] {
  const raw = readEnv(key, env);
  if (raw === undefined) {
    return [...fallback];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
