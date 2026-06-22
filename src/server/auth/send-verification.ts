import type { SQL } from "bun";
import { issueAuthToken } from "@/auth/auth-tokens.js";
import { findUserById } from "@/auth/user-queries.js";
import type { Cache } from "@/cache/cache-types.js";
import {
  EMAIL_VERIFICATIONS_TABLE,
  EMAIL_VERIFY_TTL_SECONDS,
} from "@/constants/auth-tokens.js";
import {
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from "@/constants/http-status.js";
import { MAIL_SUBJECT_VERIFY_EMAIL } from "@/constants/mail.js";
import {
  MSG_HTTP_NOT_FOUND,
  MSG_VERIFICATION_DISPATCHED,
} from "@/constants/messages.js";
import { jsonApiResponse } from "@/http/json-response.js";
import { emailVerifyBody } from "@/mail/mail-bodies.js";
import { buildEmailVerifyLink } from "@/mail/mail-links.js";
import type { Mailer } from "@/mail/mailer-types.js";
import { requireAccessToken } from "@/server/auth/shared.js";

export async function handleSendVerification(
  req: Request,
  sql: SQL,
  mailer: Mailer,
  cache: Cache,
): Promise<Response> {
  const guard = await requireAccessToken(req);
  if (!guard.ok) {
    return guard.response;
  }
  const user = await findUserById(cache, sql, guard.claims.sub);
  if (user === undefined) {
    return jsonApiResponse(
      { error: MSG_HTTP_NOT_FOUND },
      { status: HTTP_STATUS_NOT_FOUND },
      new URL(req.url),
    );
  }
  const composite = await issueAuthToken(
    sql,
    EMAIL_VERIFICATIONS_TABLE,
    guard.claims.sub,
    EMAIL_VERIFY_TTL_SECONDS,
  );
  await mailer.send({
    to: user.email,
    subject: MAIL_SUBJECT_VERIFY_EMAIL,
    text: emailVerifyBody(
      buildEmailVerifyLink(composite),
      EMAIL_VERIFY_TTL_SECONDS,
    ),
  });
  return jsonApiResponse(
    { ok: true, message: MSG_VERIFICATION_DISPATCHED },
    { status: HTTP_STATUS_OK },
    new URL(req.url),
  );
}
