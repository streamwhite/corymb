/** Raw entropy bytes for password-reset / email-verify single-use tokens. */
export const AUTH_TOKEN_BYTE_LENGTH = 32 as const;

/** Composite token format `<uuid>.<hex>` — same shape as session refresh token. */
export const AUTH_TOKEN_PART_SEPARATOR = "." as const;

/** crypto.randomUUID() length in ASCII (matches sessions). */
export const AUTH_TOKEN_UUID_CHAR_LENGTH = 36 as const;

/** Password-reset token TTL (30 min). */
export const PASSWORD_RESET_TTL_SECONDS = 60 * 30;

/** Email-verification token TTL (24h). */
export const EMAIL_VERIFY_TTL_SECONDS = 60 * 60 * 24;

export const PASSWORD_RESETS_TABLE = "password_resets" as const;

export const EMAIL_VERIFICATIONS_TABLE = "email_verifications" as const;
