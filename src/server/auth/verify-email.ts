import type { SQL } from "bun";
import { consumeAuthToken } from "@/auth/auth-tokens.js";
import { EMAIL_VERIFICATIONS_TABLE } from "@/constants/auth-tokens.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import { MAIL_LINK_TOKEN_PARAM } from "@/constants/mail.js";
import {
  MSG_AUTH_TOKEN_INVALID,
  MSG_EMAIL_VERIFIED,
  MSG_VERIFY_EMAIL_TOKEN_REQUIRED,
} from "@/constants/messages.js";
import { jsonApiResponse } from "@/http/json-response.js";

async function markEmailVerified(sql: SQL, userId: string): Promise<void> {
  await sql`UPDATE users SET email_verified = 1 WHERE id = ${userId}`;
}

export async function handleVerifyEmail(
  req: Request,
  sql: SQL,
): Promise<Response> {
  const token = new URL(req.url).searchParams.get(MAIL_LINK_TOKEN_PARAM);
  if (token === null || token.length === 0) {
    return jsonApiResponse(
      { error: MSG_VERIFY_EMAIL_TOKEN_REQUIRED },
      { status: HTTP_STATUS_BAD_REQUEST },
      new URL(req.url),
    );
  }
  const consumed = await consumeAuthToken(
    sql,
    EMAIL_VERIFICATIONS_TABLE,
    token,
  );
  if (!consumed.ok) {
    return jsonApiResponse(
      { error: MSG_AUTH_TOKEN_INVALID },
      { status: HTTP_STATUS_UNAUTHORIZED },
      new URL(req.url),
    );
  }
  await markEmailVerified(sql, consumed.userId);
  return jsonApiResponse(
    { ok: true, message: MSG_EMAIL_VERIFIED },
    { status: HTTP_STATUS_OK },
    new URL(req.url),
  );
}
