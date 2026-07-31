import { describe, expect, it } from "bun:test";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import {
  AUTH_LIST_SESSIONS_PATH,
  AUTH_REVOKE_OTHER_SESSIONS_PATH,
  AUTH_REVOKE_SESSION_PATH,
} from "@/constants/better-auth.js";
import {
  HEADER_CONTENT_TYPE,
  MIME_JSON,
  VALID_TEST_USERNAME,
} from "./constants.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import {
  BA_GET_SESSION_PATH,
  BA_SIGN_IN_PATH,
  bearerHeaders,
  SET_AUTH_TOKEN_HEADER,
  signupUser,
} from "./helpers/auth-flow.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

const validPassword = "x".repeat(MIN_PASSWORD_LENGTH);

type SessionPayload = {
  session?: { token?: string };
  user?: { id?: string };
};

function isOpaqueSessionToken(token: string): boolean {
  // Random server session tokens are not JWTs (exactly 3 base64url segments).
  return token.length > 16 && token.split(".").length !== 3;
}

async function readSession(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  bearerToken: string,
): Promise<SessionPayload | null> {
  const res = await request(BA_GET_SESSION_PATH, {
    method: "GET",
    headers: bearerHeaders(bearerToken),
  });
  return (await res.json()) as SessionPayload | null;
}

describe("server-side session management", () => {
  it("stores an opaque random session token server-side (not a JWT)", async () => {
    const { app, auth } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "opaque@example.com",
      username: "opaque_user",
      password: validPassword,
    });
    expect(signed.token).toBeTruthy();

    const session = await readSession(app.request, signed.token as string);
    const opaque = session?.session?.token;
    expect(opaque).toBeTruthy();
    expect(isOpaqueSessionToken(opaque as string)).toBe(true);

    const ctx = await auth.$context;
    const stored = await ctx.internalAdapter.findSession(opaque as string);
    expect(stored?.session.token).toBe(opaque);
  });

  it("lists active sessions for the current user", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "list@example.com",
      username: "list_user",
      password: validPassword,
    });
    const res = await app.request(AUTH_LIST_SESSIONS_PATH, {
      method: "GET",
      headers: bearerHeaders(signed.token as string),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(Array.isArray(body)).toBe(true);
    expect((body as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("revoking a session invalidates it immediately on the server", async () => {
    const { app } = await createMemoryApp();
    const first = await signupUser(app.request, {
      email: "rev@example.com",
      username: "rev_user",
      password: validPassword,
    });
    const secondSignin = await app.request(BA_SIGN_IN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "rev@example.com",
        password: validPassword,
      }),
    });
    expect(secondSignin.status).toBe(200);
    const secondBearer = secondSignin.headers.get(SET_AUTH_TOKEN_HEADER);
    expect(secondBearer).toBeTruthy();

    const secondSession = await readSession(app.request, secondBearer as string);
    const secondOpaque = secondSession?.session?.token;
    expect(secondOpaque).toBeTruthy();

    const revoke = await app.request(AUTH_REVOKE_SESSION_PATH, {
      method: "POST",
      headers: bearerHeaders(first.token as string),
      body: JSON.stringify({ token: secondOpaque }),
    });
    expect(revoke.status).toBe(200);
    const revokeBody = (await revoke.json()) as { status?: boolean };
    expect(revokeBody.status).toBe(true);

    expect(await readSession(app.request, secondBearer as string)).toBeNull();

    const alive = await readSession(app.request, first.token as string);
    expect(alive?.session).toBeTruthy();
  });

  it("revoke-other-sessions keeps only the current opaque session", async () => {
    const { app } = await createMemoryApp();
    const first = await signupUser(app.request, {
      email: "others@example.com",
      username: VALID_TEST_USERNAME,
      password: validPassword,
    });
    const secondSignin = await app.request(BA_SIGN_IN_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email: "others@example.com",
        password: validPassword,
      }),
    });
    const secondBearer = secondSignin.headers.get(SET_AUTH_TOKEN_HEADER);
    expect(secondBearer).toBeTruthy();

    const revokeOthers = await app.request(AUTH_REVOKE_OTHER_SESSIONS_PATH, {
      method: "POST",
      headers: bearerHeaders(first.token as string),
      body: "{}",
    });
    expect(revokeOthers.status).toBe(200);

    expect(await readSession(app.request, secondBearer as string)).toBeNull();
    const still = await readSession(app.request, first.token as string);
    expect(still?.session).toBeTruthy();
  });
});
