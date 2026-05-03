import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import {
  MSG_EMAIL_INVALID,
  MSG_EMAIL_REQUIRED,
  MSG_PASSWORD_REQUIRED,
  MSG_PASSWORD_TOO_SHORT,
  MSG_USERNAME_INVALID,
  MSG_USERNAME_REQUIRED,
} from "@/constants/messages.js";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from "@/constants/username.js";

export type SigninValidation =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

export type SignupValidation =
  | { ok: true; email: string; username: string; password: string }
  | { ok: false; error: string };

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function normalizeUsername(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function validateEmailPasswordCore(body: unknown): SigninValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: MSG_EMAIL_REQUIRED };
  }
  const record = body as { email?: unknown; password?: unknown };
  const email = normalizeEmail(record.email);
  const password = typeof record.password === "string" ? record.password : "";
  if (!email) {
    return { ok: false, error: MSG_EMAIL_REQUIRED };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: MSG_EMAIL_INVALID };
  }
  if (!password) {
    return { ok: false, error: MSG_PASSWORD_REQUIRED };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: MSG_PASSWORD_TOO_SHORT };
  }
  return { ok: true, email, password };
}

export function validateSigninInput(body: unknown): SigninValidation {
  return validateEmailPasswordCore(body);
}

function isValidUsernameShape(normalized: string): boolean {
  return (
    normalized.length >= USERNAME_MIN_LENGTH &&
    normalized.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(normalized)
  );
}

export function validateSignupInput(body: unknown): SignupValidation {
  const core = validateEmailPasswordCore(body);
  if (!core.ok) {
    return core;
  }
  const record = body as { username?: unknown };
  const username = normalizeUsername(record.username);
  if (!username) {
    return { ok: false, error: MSG_USERNAME_REQUIRED };
  }
  if (!isValidUsernameShape(username)) {
    return { ok: false, error: MSG_USERNAME_INVALID };
  }
  return {
    ok: true,
    email: core.email,
    username,
    password: core.password,
  };
}
