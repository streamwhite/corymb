import { describe, expect, it } from "bun:test";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "./constants.js";
import { createMemoryAppWithMailer } from "./helpers/app-memory-mail.js";
import {
  BA_REQUEST_PASSWORD_RESET_PATH,
  BA_RESET_PASSWORD_PATH,
  BA_SIGN_IN_PATH,
  signupUser,
} from "./helpers/auth-flow.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

const validPassword = "x".repeat(MIN_PASSWORD_LENGTH);
const nextPassword = `${validPassword}-next`;

function extractTokenFromMail(text: string): string | null {
  const pathMatch = text.match(/\/reset-password\/([^?\s]+)/);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }
  const queryMatch = text.match(/[?&]token=([^&\s]+)/);
  return queryMatch?.[1] ? decodeURIComponent(queryMatch[1]) : null;
}

describe("auth password reset", () => {
  it("request-password-reset returns ok for unknown email", async () => {
    const { app } = await createMemoryAppWithMailer();
    const res = await app.request(BA_REQUEST_PASSWORD_RESET_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "nobody@example.com",
        redirectTo: "http://127.0.0.1/ui",
      }),
    });
    expect(res.status).toBeLessThan(500);
  });

  it("completes reset flow from email link token", async () => {
    const { app, mailer, base } = await createMemoryAppWithMailer();
    await signupUser(app.request, {
      email: "reset@example.com",
      username: "reset_user",
      password: validPassword,
    });
    const forgot = await app.request(BA_REQUEST_PASSWORD_RESET_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "reset@example.com",
        redirectTo: `${base}ui`,
      }),
    });
    expect(forgot.status).toBeLessThan(500);
    expect(mailer.outbox.length).toBeGreaterThan(0);
    const mailText = mailer.outbox.at(-1)?.text ?? "";
    const token = extractTokenFromMail(mailText);
    if (token === null) {
      throw new Error(`Could not parse token from mail: ${mailText}`);
    }

    const reset = await app.request(BA_RESET_PASSWORD_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        token,
        newPassword: nextPassword,
      }),
    });
    expect(reset.status).toBe(200);

    const oldSignin = await app.request(BA_SIGN_IN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "reset@example.com",
        password: validPassword,
      }),
    });
    expect(oldSignin.status).toBeGreaterThanOrEqual(400);

    const newSignin = await app.request(BA_SIGN_IN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "reset@example.com",
        password: nextPassword,
      }),
    });
    expect(newSignin.status).toBe(200);
  });
});
