import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import {
  MSG_EMAIL_TAKEN,
  MSG_INVALID_CREDENTIALS,
} from "@/constants/messages.js";
import {
  AUTH_SIGNIN_PATH,
  AUTH_SIGNOUT_PATH,
  AUTH_SIGNUP_PATH,
} from "@/constants/routes.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "./constants.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { cookieHeaderFromSetCookie } from "./helpers/cookie.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

const validPassword = "x".repeat(MIN_PASSWORD_LENGTH);

describe("auth", () => {
  it("signs up, sets session cookie, and returns user", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "u1@example.com",
        password: validPassword,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: string; email: string } };
    expect(body.user.email).toBe("u1@example.com");
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  it("rejects duplicate email on signup", async () => {
    const { app } = createMemoryApp();
    const payload = {
      method: "POST" as const,
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "dup@example.com",
        password: validPassword,
      }),
    };
    const first = await app.request(AUTH_SIGNUP_PATH, payload);
    expect(first.status).toBe(201);
    const second = await app.request(AUTH_SIGNUP_PATH, payload);
    expect(second.status).toBe(409);
    const err = (await second.json()) as { error: string };
    expect(err.error).toBe(MSG_EMAIL_TAKEN);
  });

  it("signs in and returns user with new session", async () => {
    const { app } = createMemoryApp();
    await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "in@example.com",
        password: validPassword,
      }),
    });
    const res = await app.request(AUTH_SIGNIN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "in@example.com",
        password: validPassword,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe("in@example.com");
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  it("rejects wrong password", async () => {
    const { app } = createMemoryApp();
    await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "badpw@example.com",
        password: validPassword,
      }),
    });
    const res = await app.request(AUTH_SIGNIN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "badpw@example.com",
        password: `${validPassword}wrong`,
      }),
    });
    expect(res.status).toBe(401);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe(MSG_INVALID_CREDENTIALS);
  });

  it("rejects signin for unknown user", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(AUTH_SIGNIN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "ghost@example.com",
        password: validPassword,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("signs out and clears session cookie", async () => {
    const { app } = createMemoryApp();
    const signUp = await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "out@example.com",
        password: validPassword,
      }),
    });
    const cookieIn = cookieHeaderFromSetCookie(
      signUp.headers.get("set-cookie"),
    );
    expect(cookieIn).toBeDefined();
    const out = await app.request(AUTH_SIGNOUT_PATH, {
      method: "POST",
      headers: { ...jsonHeaders, ...cookieIn },
    });
    expect(out.status).toBe(200);
    const cleared = (await out.json()) as { ok: boolean };
    expect(cleared.ok).toBe(true);
    const setCookie = out.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie?.toLowerCase()).toMatch(/max-age=0|expires=/);
  });

  it("signout without cookie is idempotent", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(AUTH_SIGNOUT_PATH, {
      method: "POST",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
  });
});
