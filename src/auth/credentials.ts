import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import {
  MSG_EMAIL_INVALID,
  MSG_EMAIL_REQUIRED,
  MSG_PASSWORD_REQUIRED,
  MSG_PASSWORD_TOO_SHORT,
} from "@/constants/messages.js";

export type CredentialValidation =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function validateSignupInput(body: unknown): CredentialValidation {
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
