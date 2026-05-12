import { describe, expect, it } from "bun:test";
import { MAIL_LINK_TOKEN_PARAM } from "@/constants/mail.js";
import {
  MSG_ACCESS_TOKEN_REQUIRED,
  MSG_AUTH_TOKEN_INVALID,
  MSG_EMAIL_VERIFIED,
} from "@/constants/messages.js";
import {
  AUTH_SEND_VERIFICATION_PATH,
  AUTH_VERIFY_EMAIL_PATH,
} from "@/constants/routes.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "./constants.js";
import { createMemoryAppWithMailer } from "./helpers/app-memory-mail.js";
import { signupUser } from "./helpers/auth-flow.js";
import { authorizationBearerHeaders } from "./helpers/bearer.js";
import { extractTokenFromMailText } from "./helpers/mail-token.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

function buildVerifyPath(token: string): string {
  return `${AUTH_VERIFY_EMAIL_PATH}?${MAIL_LINK_TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

describe("auth email verification", () => {
  it("send-verification requires access token", async () => {
    const { app } = await createMemoryAppWithMailer();
    const res = await app.request(AUTH_SEND_VERIFICATION_PATH, {
      method: "POST",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(401);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe(MSG_ACCESS_TOKEN_REQUIRED);
  });

  it("send-verification + verify-email sets email_verified=1", async () => {
    const { app, mailer, sql } = await createMemoryAppWithMailer();
    const userEmail = "verify@example.com";
    const user = await signupUser(app.request, {
      email: userEmail,
      username: "verify_user",
    });
    const send = await app.request(AUTH_SEND_VERIFICATION_PATH, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        ...authorizationBearerHeaders(user.accessToken),
      },
    });
    expect(send.status).toBe(200);
    const mail = mailer.lastFor(userEmail);
    expect(mail).toBeDefined();
    const token = extractTokenFromMailText(mail?.text ?? "") ?? "";
    expect(token.length).toBeGreaterThan(0);
    const verify = await app.request(buildVerifyPath(token));
    expect(verify.status).toBe(200);
    const body = (await verify.json()) as { message: string };
    expect(body.message).toBe(MSG_EMAIL_VERIFIED);
    const rows =
      (await sql`SELECT email_verified AS emailVerified FROM users WHERE id = ${user.userId}`) as Array<{
        emailVerified: number;
      }>;
    expect(rows[0]?.emailVerified).toBe(1);
  });

  it("verify-email rejects reuse of the same token", async () => {
    const { app, mailer } = await createMemoryAppWithMailer();
    const userEmail = "reuse@example.com";
    const user = await signupUser(app.request, {
      email: userEmail,
      username: "reuse_user",
    });
    await app.request(AUTH_SEND_VERIFICATION_PATH, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        ...authorizationBearerHeaders(user.accessToken),
      },
    });
    const token =
      extractTokenFromMailText(mailer.lastFor(userEmail)?.text ?? "") ?? "";
    const first = await app.request(buildVerifyPath(token));
    expect(first.status).toBe(200);
    const second = await app.request(buildVerifyPath(token));
    expect(second.status).toBe(401);
    const err = (await second.json()) as { error: string };
    expect(err.error).toBe(MSG_AUTH_TOKEN_INVALID);
  });

  it("verify-email requires the token query parameter", async () => {
    const { app } = await createMemoryAppWithMailer();
    const res = await app.request(AUTH_VERIFY_EMAIL_PATH);
    expect(res.status).toBe(400);
  });
});
