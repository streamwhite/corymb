/** Separator between session UUID and hex secret in the cookie value (UUID has no `.`). */
export const SESSION_COOKIE_PART_SEPARATOR = "." as const;

/** `crypto.randomUUID()` length in ASCII. */
export const SESSION_UUID_CHAR_LENGTH = 36 as const;

/**
 * Argon2id PHC strings for session secrets — see
 * https://bun.com/docs/runtime/hashing#argon2-phc-format
 * Memory cost is KiB (per Bun.password options).
 */
export const SESSION_ARGON2_OPTS = {
  algorithm: "argon2id" as const,
  memoryCost: 256,
  timeCost: 2,
} as const;
