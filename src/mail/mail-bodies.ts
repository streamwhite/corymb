import { PASSWORD_RESET_TTL_SECONDS } from "@/constants/auth-tokens.js";

const SECONDS_PER_MINUTE = 60 as const;

const SECONDS_PER_HOUR = 3600 as const;

function ttlMinutes(seconds: number): number {
  return Math.max(1, Math.floor(seconds / SECONDS_PER_MINUTE));
}

function ttlHours(seconds: number): number {
  return Math.max(1, Math.floor(seconds / SECONDS_PER_HOUR));
}

export function passwordResetBody(link: string): string {
  const minutes = ttlMinutes(PASSWORD_RESET_TTL_SECONDS);
  return `Reset your password by opening this link (valid for ${String(minutes)} minutes):\n\n${link}\n\nIf you did not request a reset, ignore this email.`;
}

export function emailVerifyBody(link: string, ttlSeconds: number): string {
  const hours = ttlHours(ttlSeconds);
  return `Verify your email by opening this link (valid for ${String(hours)} hours):\n\n${link}\n\nIf you did not request this, ignore this email.`;
}
