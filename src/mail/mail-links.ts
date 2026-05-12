import {
  DEFAULT_APP_PUBLIC_BASE_URL,
  ENV_APP_PUBLIC_BASE_URL,
  MAIL_LINK_TOKEN_PARAM,
} from "@/constants/mail.js";
import {
  AUTH_RESET_PASSWORD_PATH,
  AUTH_VERIFY_EMAIL_PATH,
} from "@/constants/routes.js";

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
  return buildLink(AUTH_RESET_PASSWORD_PATH, token);
}

export function buildEmailVerifyLink(token: string): string {
  return buildLink(AUTH_VERIFY_EMAIL_PATH, token);
}
