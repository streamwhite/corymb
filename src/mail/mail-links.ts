import {
  DEFAULT_APP_PUBLIC_BASE_URL,
  ENV_APP_PUBLIC_BASE_URL,
  MAIL_LINK_TOKEN_PARAM,
} from "@/constants/mail.js";
import { BETTER_AUTH_BASE_PATH } from "@/constants/better-auth.js";

const RESET_PASSWORD_PATH = `${BETTER_AUTH_BASE_PATH}/reset-password` as const;
const VERIFY_EMAIL_PATH = `${BETTER_AUTH_BASE_PATH}/verify-email` as const;

function publicBaseUrl(): string {
  const raw = process.env[ENV_APP_PUBLIC_BASE_URL];
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_APP_PUBLIC_BASE_URL;
  }
  return raw.replace(/\/+$/, "");
}

function buildLink(path: string, token: string): string {
  const url = new URL(path, `${publicBaseUrl()}/`);
  url.searchParams.set(MAIL_LINK_TOKEN_PARAM, token);
  return url.toString();
}

export function buildPasswordResetLink(token: string): string {
  return buildLink(RESET_PASSWORD_PATH, token);
}

export function buildEmailVerifyLink(token: string): string {
  return buildLink(VERIFY_EMAIL_PATH, token);
}
