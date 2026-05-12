import { describe, expect, it } from "bun:test";
import {
  RESPONSE_FIELD_ACCESS_TOKEN,
  RESPONSE_FIELD_REFRESH_TOKEN,
} from "@/constants/auth.js";
import {
  MSG_AUTH_TOKEN_INVALID,
  MSG_PASSWORD_RESET_DISPATCHED,
} from "@/constants/messages.js";
import {
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_REFRESH_PATH,
  AUTH_RESET_PASSWORD_PATH,
  AUTH_SIGNIN_PATH,
} from "@/constants/routes.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "./constants.js";
import { createMemoryAppWithMailer } from "./helpers/app-memory-mail.js";
import { defaultPassword, signupUser } from "./helpers/auth-flow.js";
import { extractTokenFromMailText } from "./helpers/mail-token.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

const NEW_PASSWORD = "new-strong-password";

async function postForgot(
  request: (p: string, init?: RequestInit) => Promise<Response>,
  email: string,
): Promise<Response> {
  return request(AUTH_FORGOT_PASSWORD_PATH, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email }),
  });
}

async function postReset(
  request: (p: string, init?: RequestInit) => Promise<Response>,
  token: string,
  password: string,
): Promise<Response> {
  return request(AUTH_RESET_PASSWORD_PATH, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ token, password }),
  });
}

describe("auth password reset", () => {
  it("forgot-password returns generic 200 for unknown email (no enumeration)", async () => {
    const { app, mailer } = await createMemoryAppWithMailer();
    const res = await postForgot(app.request, "ghost@example.com");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe(MSG_PASSWORD_RESET_DISPATCHED);
    expect(mailer.outbox.length).toBe(0);
  });

  it("forgot-password sends mail for registered email; reset completes flow", async () => {
    const { app, mailer } = await createMemoryAppWithMailer();
    const userEmail = "reset@example.com";
    const user = await signupUser(app.request, {
      email: userEmail,
      username: "reset_user",
    });
    expect(user.refreshToken.length).toBeGreaterThan(0);
    const forgot = await postForgot(app.request, userEmail);
    expect(forgot.status).toBe(200);
    const mail = mailer.lastFor(userEmail);
    expect(mail).toBeDefined();
    const token = extractTokenFromMailText(mail?.text ?? "");
    expect(typeof token).toBe("string");
    const reset = await postReset(app.request, token ?? "", NEW_PASSWORD);
    expect(reset.status).toBe(200);
    const signin = await app.request(AUTH_SIGNIN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email: userEmail, password: NEW_PASSWORD }),
    });
    expect(signin.status).toBe(200);
    const body = (await signin.json()) as Record<string, unknown>;
    expect(typeof body[RESPONSE_FIELD_ACCESS_TOKEN]).toBe("string");
  });

  it("reset revokes all sessions for the user", async () => {
    const { app, mailer } = await createMemoryAppWithMailer();
    const userEmail = "sess@example.com";
    const user = await signupUser(app.request, {
      email: userEmail,
      username: "sess_user",
    });
    await postForgot(app.request, userEmail);
    const mail = mailer.lastFor(userEmail);
    const token = extractTokenFromMailText(mail?.text ?? "") ?? "";
    const reset = await postReset(app.request, token, NEW_PASSWORD);
    expect(reset.status).toBe(200);
    const refresh = await app.request(AUTH_REFRESH_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        [RESPONSE_FIELD_REFRESH_TOKEN]: user.refreshToken,
      }),
    });
    expect(refresh.status).toBe(401);
  });

  it("reset token cannot be reused", async () => {
    const { app, mailer } = await createMemoryAppWithMailer();
    const userEmail = "once@example.com";
    await signupUser(app.request, {
      email: userEmail,
      username: "once_user",
    });
    await postForgot(app.request, userEmail);
    const mail = mailer.lastFor(userEmail);
    const token = extractTokenFromMailText(mail?.text ?? "") ?? "";
    const first = await postReset(app.request, token, NEW_PASSWORD);
    expect(first.status).toBe(200);
    const second = await postReset(app.request, token, defaultPassword);
    expect(second.status).toBe(401);
    const err = (await second.json()) as { error: string };
    expect(err.error).toBe(MSG_AUTH_TOKEN_INVALID);
  });
});
