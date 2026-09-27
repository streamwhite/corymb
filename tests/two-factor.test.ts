import { describe, expect, it } from "bun:test";
import { BETTER_AUTH_BASE_PATH } from "@/constants/better-auth.js";
import { createMemoryAppWithMailer } from "./helpers/app-memory-mail.js";
import { signupUser } from "./helpers/auth-flow.js";
import { PG_AVAILABLE } from "./helpers/test-db.js";

const ENABLE_2FA_PATH = `${BETTER_AUTH_BASE_PATH}/two-factor/enable` as const;
const SEND_OTP_PATH = `${BETTER_AUTH_BASE_PATH}/two-factor/send-otp` as const;
const VERIFY_OTP_PATH = `${BETTER_AUTH_BASE_PATH}/two-factor/verify-otp` as const;

const PASSWORD = "x".repeat(16);
const EMAIL = "twofa@example.com";
const OTP_PATTERN = /(\d{6})/;

function extractOtp(text: string): string | undefined {
  return OTP_PATTERN.exec(text)?.[1];
}

describe.skipIf(!PG_AVAILABLE)("two-factor OTP", () => {
  const jsonHeaders = { "Content-Type": "application/json" } as const;

  async function setupEnabled() {
    const { app, mailer } = await createMemoryAppWithMailer();
    const signed = await signupUser(app.request, {
      email: EMAIL,
      username: "twofa_user",
      password: PASSWORD,
    });
    expect(signed.status).toBe(200);
    const jar = { value: signed.cookies };

    const enable = await app.requestWithCookies(
      ENABLE_2FA_PATH,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ password: PASSWORD, method: "otp" }),
      },
      jar,
    );
    expect(enable.status).toBe(200);
    return { app, mailer, jar };
  }

  it("enables OTP two-factor and emails a verifiable code", async () => {
    const { app, mailer, jar } = await setupEnabled();

    const send = await app.requestWithCookies(
      SEND_OTP_PATH,
      { method: "POST", headers: jsonHeaders, body: JSON.stringify({}) },
      jar,
    );
    expect(send.status).toBe(200);

    const mail = mailer.lastFor(EMAIL);
    expect(mail?.subject).toBeTruthy();
    const otp = extractOtp(mail?.text ?? "");
    expect(otp).toBeDefined();

    const verify = await app.requestWithCookies(
      VERIFY_OTP_PATH,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ code: otp }),
      },
      jar,
    );
    expect(verify.status).toBe(200);
    const body = (await verify.json()) as { token?: string };
    expect(body.token).toBeTruthy();
  });

  it("rejects an invalid OTP code", async () => {
    const { app, jar } = await setupEnabled();
    await app.requestWithCookies(
      SEND_OTP_PATH,
      { method: "POST", headers: jsonHeaders, body: JSON.stringify({}) },
      jar,
    );
    const verify = await app.requestWithCookies(
      VERIFY_OTP_PATH,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ code: "000000" }),
      },
      jar,
    );
    expect(verify.status).toBeGreaterThanOrEqual(400);
  });

  it("exposes two-factor routes under the auth base path", () => {
    expect(ENABLE_2FA_PATH).toBe("/api/auth/two-factor/enable");
    expect(VERIFY_OTP_PATH).toBe("/api/auth/two-factor/verify-otp");
  });
});
