export const BCRYPT_COST_DEFAULT = 12;

/** Used by the test runner preload; keep in sync with Bun bcrypt `cost` limits (4–31). */
export const BCRYPT_COST_TEST = 4;

export const ENV_BCRYPT_COST = "BCRYPT_COST" as const;

const BCRYPT_COST_MIN = 4;
const BCRYPT_COST_MAX = 31;

export function resolveBcryptCostFromEnv(): number {
  const raw = process.env[ENV_BCRYPT_COST];
  if (raw === undefined || raw === "") {
    return BCRYPT_COST_DEFAULT;
  }
  const parsed = Number(raw);
  if (
    !Number.isInteger(parsed) ||
    parsed < BCRYPT_COST_MIN ||
    parsed > BCRYPT_COST_MAX
  ) {
    throw new Error(
      `${ENV_BCRYPT_COST} must be an integer between ${String(BCRYPT_COST_MIN)} and ${String(BCRYPT_COST_MAX)}, got: ${String(raw)}`,
    );
  }
  return parsed;
}
