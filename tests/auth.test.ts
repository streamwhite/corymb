import { describe, expect, it } from "bun:test";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import { AUTH_SESSION_ROTATE_PATH } from "@/constants/better-auth.js";
import {
  HEADER_CONTENT_TYPE,
  MIME_JSON,
  VALID_TEST_USERNAME,
} from "./constants.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import {
  BA_GET_SESSION_PATH,
  BA_SIGN_IN_PATH,
  BA_SIGN_OUT_PATH,
  BA_SIGN_UP_PATH,
  BA_TOKEN_PATH,
  bearerHeaders,
  SET_AUTH_TOKEN_HEADER,
  signupUser,
} from "./helpers/auth-flow.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

const validPassword = "x".repeat(MIN_PASSWORD_LENGTH);

describe("auth", () => {
  it("signs up and returns session via set-auth-token / cookie", async () => {
    const { app } = await createMemoryApp();
    const result = await signupUser(app.request, {
      email: "u1@example.com",
      username: "user_one",
      password: validPassword,
    });
    expect(result.status).toBe(200);
    expect(result.token).toBeTruthy();
    expect(result.cookies.length).toBeGreaterThan(0);
  });

  it("rejects duplicate email on signup", async () => {
    const { app } = await createMemoryApp();
    const first = await signupUser(app.request, {
      email: "dup@example.com",
      username: "dup_email_user",
      password: validPassword,
    });
    expect(first.status).toBe(200);
    const second = await signupUser(app.request, {
      email: "dup@example.com",
      username: "other_username_ok",
      password: validPassword,
    });
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects duplicate username on signup", async () => {
    const { app } = await createMemoryApp();
    await signupUser(app.request, {
      email: "first@example.com",
      username: "shared_name",
      password: validPassword,
    });
    const second = await signupUser(app.request, {
      email: "second@example.com",
      username: "shared_name",
      password: validPassword,
    });
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it("signs in and establishes a session", async () => {
    const { app } = await createMemoryApp();
    await signupUser(app.request, {
      email: "in@example.com",
      username: "in_user",
      password: validPassword,
    });
    const res = await app.request(BA_SIGN_IN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "in@example.com",
        password: validPassword,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get(SET_AUTH_TOKEN_HEADER)).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const { app } = await createMemoryApp();
    await signupUser(app.request, {
      email: "badpw@example.com",
      username: "badpw_user",
      password: validPassword,
    });
    const res = await app.request(BA_SIGN_IN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "badpw@example.com",
        password: `${validPassword}wrong`,
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("signs out and invalidates bearer session", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "out@example.com",
      username: "out_user",
      password: validPassword,
    });
    expect(signed.token).toBeTruthy();
    const out = await app.request(BA_SIGN_OUT_PATH, {
      method: "POST",
      headers: bearerHeaders(signed.token as string),
      body: "{}",
    });
    expect(out.status).toBe(200);
    const session = await app.request(BA_GET_SESSION_PATH, {
      method: "GET",
      headers: bearerHeaders(signed.token as string),
    });
    const body = (await session.json()) as unknown;
    expect(body).toBeNull();
  });

  it("issues a short-lived access JWT via /token", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "jwt@example.com",
      username: VALID_TEST_USERNAME,
      password: validPassword,
    });
    const res = await app.request(BA_TOKEN_PATH, {
      method: "GET",
      headers: bearerHeaders(signed.token as string),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token?: string };
    expect(typeof body.token).toBe("string");
    expect((body.token as string).split(".").length).toBe(3);
  });

  it("rotates session and rejects the previous token", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "rot@example.com",
      username: "rot_user",
      password: validPassword,
    });
    const oldToken = signed.token as string;
    const rotated = await app.request(AUTH_SESSION_ROTATE_PATH, {
      method: "POST",
      headers: bearerHeaders(oldToken),
      body: "{}",
    });
    expect(rotated.status).toBe(200);
    const newToken = rotated.headers.get(SET_AUTH_TOKEN_HEADER);
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(oldToken);

    const oldSession = await app.request(BA_GET_SESSION_PATH, {
      method: "GET",
      headers: bearerHeaders(oldToken),
    });
    expect(await oldSession.json()).toBeNull();

    const newSession = await app.request(BA_GET_SESSION_PATH, {
      method: "GET",
      headers: bearerHeaders(newToken as string),
    });
    const sessionBody = (await newSession.json()) as { session?: unknown };
    expect(sessionBody?.session).toBeTruthy();
  });
});

describe("auth paths", () => {
  it("exposes Better Auth base paths", () => {
    expect(BA_SIGN_UP_PATH).toContain("/api/auth/");
    expect(BA_SIGN_OUT_PATH).toContain("/api/auth/");
  });
});
