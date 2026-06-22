import type { SQL } from "bun";
import { issueAuthToken } from "@/auth/auth-tokens.js";
import { normalizeEmail } from "@/auth/credentials.js";
import { findUserIdByEmail } from "@/auth/user-queries.js";
import type { Cache } from "@/cache/cache-types.js";
import {
  PASSWORD_RESET_TTL_SECONDS,
  PASSWORD_RESETS_TABLE,
} from "@/constants/auth-tokens.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_OK,
} from "@/constants/http-status.js";
import { MAIL_SUBJECT_PASSWORD_RESET } from "@/constants/mail.js";
import {
  MSG_EMAIL_REQUIRED,
  MSG_PASSWORD_RESET_DISPATCHED,
} from "@/constants/messages.js";
import { readJsonUnknown } from "@/http/json-body.js";
import { jsonApiResponse } from "@/http/json-response.js";
import { passwordResetBody } from "@/mail/mail-bodies.js";
import { buildPasswordResetLink } from "@/mail/mail-links.js";
import type { Mailer } from "@/mail/mailer-types.js";

function pickEmail(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "";
  }
  return normalizeEmail((value as { email?: unknown }).email);
}

async function dispatchPasswordResetEmail(
  mailer: Mailer,
  to: string,
  link: string,
): Promise<void> {
  // intentional fire-and-await so the generic response timing is similar regardless of email existence
  await mailer.send({
    to,
    subject: MAIL_SUBJECT_PASSWORD_RESET,
    text: passwordResetBody(link),
  });
}

function genericDispatchedResponse(req: Request): Response {
  return jsonApiResponse(
    { ok: true, message: MSG_PASSWORD_RESET_DISPATCHED },
    { status: HTTP_STATUS_OK },
    new URL(req.url),
  );
}

export async function handleForgotPassword(
  req: Request,
  sql: SQL,
  mailer: Mailer,
  cache: Cache,
): Promise<Response> {
  const parsed = await readJsonUnknown(req);
  if (!parsed.ok) {
    return jsonApiResponse(
      { error: parsed.error },
      { status: parsed.status },
      new URL(req.url),
    );
  }
  const email = pickEmail(parsed.value);
  if (email.length === 0) {
    return jsonApiResponse(
      { error: MSG_EMAIL_REQUIRED },
      { status: HTTP_STATUS_BAD_REQUEST },
      new URL(req.url),
    );
  }
  const userId = await findUserIdByEmail(cache, sql, email);
  if (userId !== undefined) {
    const token = await issueAuthToken(
      sql,
      PASSWORD_RESETS_TABLE,
      userId,
      PASSWORD_RESET_TTL_SECONDS,
    );
    await dispatchPasswordResetEmail(
      mailer,
      email,
      buildPasswordResetLink(token),
    );
  }
  return genericDispatchedResponse(req);
}
