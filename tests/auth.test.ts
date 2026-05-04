import { describe, expect, it } from "bun:test";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import {
  MSG_EMAIL_TAKEN,
  MSG_INVALID_CREDENTIALS,
  MSG_USERNAME_TAKEN,
} from "@/constants/messages.js";
import {
  AUTH_SIGNIN_PATH,
  AUTH_SIGNOUT_PATH,
  AUTH_SIGNUP_PATH,
} from "@/constants/routes.js";
import {
  HEADER_CONTENT_TYPE,
  MIME_JSON,
  VALID_TEST_USERNAME,
} from "./constants.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { cookieHeaderFromSetCookie } from "./helpers/cookie.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

const validPassword = "x".repeat(MIN_PASSWORD_LENGTH);

function signupBody(email: string, username = VALID_TEST_USERNAME) {
  return JSON.stringify({
    email,
    username,
    password: validPassword,
  });
}

describe("auth", () => {
  it("signs up, sets session cookie, and returns user", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signupBody("u1@example.com", "user_one"),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      user: { id: string; email: string; username: string };
    };
    expect(body.user.email).toBe("u1@example.com");
    expect(body.user.username).toBe("user_one");
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  it("rejects duplicate email on signup", async () => {
    const { app } = await createMemoryApp();
    const payload = {
      method: "POST" as const,
      headers: jsonHeaders,
      body: signupBody("dup@example.com", "dup_email_user"),
    };
    const first = await app.request(AUTH_SIGNUP_PATH, payload);
    expect(first.status).toBe(201);
    const second = await app.request(AUTH_SIGNUP_PATH, {
      ...payload,
      body: JSON.stringify({
        email: "dup@example.com",
        username: "other_username_ok",
        password: validPassword,
      }),
    });
    expect(second.status).toBe(409);
    const err = (await second.json()) as { error: string };
    expect(err.error).toBe(MSG_EMAIL_TAKEN);
  });

  it("rejects duplicate username on signup", async () => {
    const { app } = await createMemoryApp();
    await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signupBody("first@example.com", "shared_name"),
    });
    const second = await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "second@example.com",
        username: "shared_name",
        password: validPassword,
      }),
    });
    expect(second.status).toBe(409);
    const err = (await second.json()) as { error: string };
    expect(err.error).toBe(MSG_USERNAME_TAKEN);
  });

  it("signs in and returns user with new session", async () => {
    const { app } = await createMemoryApp();
    await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signupBody("in@example.com", "in_user"),
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
    const body = (await res.json()) as {
      user: { email: string; username: string };
    };
    expect(body.user.email).toBe("in@example.com");
    expect(body.user.username).toBe("in_user");
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  it("rejects wrong password", async () => {
    const { app } = await createMemoryApp();
    await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signupBody("badpw@example.com", "badpw_user"),
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
    const { app } = await createMemoryApp();
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
    const { app } = await createMemoryApp();
    const signUp = await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signupBody("out@example.com", "out_user"),
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
    const { app } = await createMemoryApp();
    const res = await app.request(AUTH_SIGNOUT_PATH, {
      method: "POST",
      headers: jsonHeaders,
    });
    expect(res.status).toBe(200);
  });
});
