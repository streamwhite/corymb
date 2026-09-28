import { parsePositiveIntEnv } from "@/constants/env-int.js";

/** Two-factor (OTP) plugin tuning. */
export const ENV_TWO_FACTOR_OTP_DIGITS = "TWO_FACTOR_OTP_DIGITS" as const;

export const ENV_TWO_FACTOR_OTP_PERIOD_MINUTES =
  "TWO_FACTOR_OTP_PERIOD_MINUTES" as const;

export const ENV_TWO_FACTOR_OTP_ATTEMPTS =
  "TWO_FACTOR_OTP_ATTEMPTS" as const;

export const DEFAULT_TWO_FACTOR_OTP_DIGITS = 6 as const;

export const DEFAULT_TWO_FACTOR_OTP_PERIOD_MINUTES = 3 as const;

export const DEFAULT_TWO_FACTOR_OTP_ATTEMPTS = 5 as const;

export function resolveTwoFactorOtpDigitsFromEnv(): number {
  return parsePositiveIntEnv(
    process.env[ENV_TWO_FACTOR_OTP_DIGITS],
    DEFAULT_TWO_FACTOR_OTP_DIGITS,
  );
}

export function resolveTwoFactorOtpPeriodMinutesFromEnv(): number {
  return parsePositiveIntEnv(
    process.env[ENV_TWO_FACTOR_OTP_PERIOD_MINUTES],
    DEFAULT_TWO_FACTOR_OTP_PERIOD_MINUTES,
  );
}

export function resolveTwoFactorOtpAttemptsFromEnv(): number {
  return parsePositiveIntEnv(
    process.env[ENV_TWO_FACTOR_OTP_ATTEMPTS],
    DEFAULT_TWO_FACTOR_OTP_ATTEMPTS,
  );
}

/** Two-factor (TOTP / authenticator apps) plugin tuning. */
export const ENV_TWO_FACTOR_TOTP_DIGITS = "TWO_FACTOR_TOTP_DIGITS" as const;

export const ENV_TWO_FACTOR_TOTP_PERIOD_SECONDS =
  "TWO_FACTOR_TOTP_PERIOD_SECONDS" as const;

export const ENV_TWO_FACTOR_ISSUER = "TWO_FACTOR_ISSUER" as const;

export const DEFAULT_TWO_FACTOR_TOTP_DIGITS = 6 as const;

export const DEFAULT_TWO_FACTOR_TOTP_PERIOD_SECONDS = 30 as const;

export const DEFAULT_TWO_FACTOR_ISSUER = "Corymb" as const;

const TOTP_ALLOWED_DIGITS = [6, 8] as const;

export type TotpDigits = (typeof TOTP_ALLOWED_DIGITS)[number];

export function resolveTwoFactorTotpDigitsFromEnv(): TotpDigits {
  const digits = parsePositiveIntEnv(
    process.env[ENV_TWO_FACTOR_TOTP_DIGITS],
    DEFAULT_TWO_FACTOR_TOTP_DIGITS,
  );
  return TOTP_ALLOWED_DIGITS.includes(digits as TotpDigits)
    ? (digits as TotpDigits)
    : DEFAULT_TWO_FACTOR_TOTP_DIGITS;
}

export function resolveTwoFactorTotpPeriodSecondsFromEnv(): number {
  return parsePositiveIntEnv(
    process.env[ENV_TWO_FACTOR_TOTP_PERIOD_SECONDS],
    DEFAULT_TWO_FACTOR_TOTP_PERIOD_SECONDS,
  );
}

export function resolveTwoFactorIssuerFromEnv(): string {
  const fromEnv = process.env[ENV_TWO_FACTOR_ISSUER];
  return fromEnv !== undefined && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_TWO_FACTOR_ISSUER;
}
