import { describe, expect, it } from "bun:test";
import {
  isSessionFresh,
  requireSensitiveVerification,
} from "@/auth/sensitive-guard.js";
import { createSensitiveVerifyStore } from "@/auth/sensitive-verify-store.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import { AUTH_SESSION_VERIFY_PATH } from "@/constants/better-auth.js";
import { MSG_PASSWORD_REQUIRED } from "@/constants/messages.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "./constants.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { bearerHeaders, signupUser } from "./helpers/auth-flow.js";

const VALID_PASSWORD = "x".repeat(MIN_PASSWORD_LENGTH);
const VERIFY_TTL_SECONDS = 300;
const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

describe("isSessionFresh", () => {
  const createdAt = 1_000_000;

  it("is fresh inside the window", () => {
    expect(isSessionFresh(createdAt, 60, createdAt + 30_000)).toBe(true);
  });

  it("is stale past the window", () => {
    expect(isSessionFresh(createdAt, 60, createdAt + 60_000)).toBe(false);
  });

  it("treats a non-positive fresh age as disabled", () => {
    expect(isSessionFresh(createdAt, 0, createdAt + 10 ** 9)).toBe(true);
  });
});

describe("sensitive verification guard", () => {
  it("blocks a stale unverified session and allows it after verification", async () => {
    const { app, auth } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "guard@example.com",
      username: "guard_user",
      password: VALID_PASSWORD,
    });
    const req = new Request("http://127.0.0.1/sensitive", {
      headers: bearerHeaders(signed.token as string),
    });
    const store = createSensitiveVerifyStore(
      createMemoryCache(),
      VERIFY_TTL_SECONDS,
    );
    const deps = {
      auth,
      store,
      freshAgeSeconds: 1,
      now: () => Date.now() + 60_000,
    };

    const blocked = await requireSensitiveVerification(req, deps);
    expect(blocked?.status).toBe(HTTP_STATUS_FORBIDDEN);

    const session = await auth.api.getSession({ headers: req.headers });
    await store.mark(session?.session.id as string);

    expect(await requireSensitiveVerification(req, deps)).toBeNull();
  });

  it("rejects a request without a session", async () => {
    const { auth } = await createMemoryApp();
    const store = createSensitiveVerifyStore(
      createMemoryCache(),
      VERIFY_TTL_SECONDS,
    );
    const res = await requireSensitiveVerification(
      new Request("http://127.0.0.1/sensitive"),
      { auth, store, freshAgeSeconds: 60 },
    );
    expect(res?.status).toBe(HTTP_STATUS_UNAUTHORIZED);
  });
});

describe("sensitive verify endpoint", () => {
  it("verifies the password and records the session", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "verify@example.com",
      username: "verify_user",
      password: VALID_PASSWORD,
    });
    const res = await app.request(AUTH_SESSION_VERIFY_PATH, {
      method: "POST",
      headers: bearerHeaders(signed.token as string),
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(res.status).toBe(HTTP_STATUS_OK);
    const body = (await res.json()) as { verified?: boolean };
    expect(body.verified).toBe(true);
  });

  it("rejects an invalid password", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "wrongpass@example.com",
      username: "wrongpass_user",
      password: VALID_PASSWORD,
    });
    const res = await app.request(AUTH_SESSION_VERIFY_PATH, {
      method: "POST",
      headers: bearerHeaders(signed.token as string),
      body: JSON.stringify({ password: `${VALID_PASSWORD}-nope` }),
    });
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it("requires a password in the body", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "nopass@example.com",
      username: "nopass_user",
      password: VALID_PASSWORD,
    });
    const res = await app.request(AUTH_SESSION_VERIFY_PATH, {
      method: "POST",
      headers: bearerHeaders(signed.token as string),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_PASSWORD_REQUIRED);
  });

  it("requires an authenticated session", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(AUTH_SESSION_VERIFY_PATH, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
  });
});
