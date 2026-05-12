import type { SQL } from "bun";
import { issueAuthToken } from "@/auth/auth-tokens.js";
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

type UserEmailRow = { email: string; emailVerified: number };

function firstUserEmailRow(rows: unknown): UserEmailRow | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  return rows[0] as UserEmailRow;
}

async function findUserEmail(
  sql: SQL,
  userId: string,
): Promise<UserEmailRow | undefined> {
  const rows = await sql`
    SELECT email, email_verified AS emailVerified
    FROM users
    WHERE id = ${userId}
  `;
  return firstUserEmailRow(rows);
}

export async function handleSendVerification(
  req: Request,
  sql: SQL,
  mailer: Mailer,
): Promise<Response> {
  const guard = await requireAccessToken(req);
  if (!guard.ok) {
    return guard.response;
  }
  const user = await findUserEmail(sql, guard.claims.sub);
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
