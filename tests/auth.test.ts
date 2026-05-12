import { describe, expect, it } from "bun:test";
import {
  MIN_PASSWORD_LENGTH,
  RESPONSE_FIELD_ACCESS_TOKEN,
  RESPONSE_FIELD_REFRESH_TOKEN,
} from "@/constants/auth.js";
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

type TokenPair = {
  user: { id: string; email: string; username: string };
  [RESPONSE_FIELD_ACCESS_TOKEN]: string;
  [RESPONSE_FIELD_REFRESH_TOKEN]: string;
};

describe("auth", () => {
  it("signs up, returns user and access + refresh tokens (no cookie)", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signupBody("u1@example.com", "user_one"),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as TokenPair;
    expect(body.user.email).toBe("u1@example.com");
    expect(body.user.username).toBe("user_one");
    expect(typeof body[RESPONSE_FIELD_ACCESS_TOKEN]).toBe("string");
    expect(typeof body[RESPONSE_FIELD_REFRESH_TOKEN]).toBe("string");
    expect(body[RESPONSE_FIELD_ACCESS_TOKEN].split(".").length).toBe(3);
    expect(body[RESPONSE_FIELD_REFRESH_TOKEN].length).toBeGreaterThan(40);
    expect(res.headers.get("set-cookie")).toBeNull();
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

  it("signs in and returns user with new token pair", async () => {
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
    const body = (await res.json()) as TokenPair;
    expect(body.user.email).toBe("in@example.com");
    expect(body.user.username).toBe("in_user");
    expect(typeof body[RESPONSE_FIELD_ACCESS_TOKEN]).toBe("string");
    expect(typeof body[RESPONSE_FIELD_REFRESH_TOKEN]).toBe("string");
    expect(res.headers.get("set-cookie")).toBeNull();
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

  it("signs out with refreshToken body and revokes session", async () => {
    const { app } = await createMemoryApp();
    const signUp = await app.request(AUTH_SIGNUP_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: signupBody("out@example.com", "out_user"),
    });
    const su = (await signUp.json()) as TokenPair;
    const refreshToken = su[RESPONSE_FIELD_REFRESH_TOKEN];
    expect(refreshToken.length).toBeGreaterThan(0);
    const out = await app.request(AUTH_SIGNOUT_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        [RESPONSE_FIELD_REFRESH_TOKEN]: refreshToken,
      }),
    });
    expect(out.status).toBe(200);
    const cleared = (await out.json()) as { ok: boolean };
    expect(cleared.ok).toBe(true);
    expect(out.headers.get("set-cookie")).toBeNull();
  });

  it("signout with invalid refreshToken body is idempotent", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(AUTH_SIGNOUT_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        [RESPONSE_FIELD_REFRESH_TOKEN]: "bogus",
      }),
    });
    expect(res.status).toBe(200);
  });
});
