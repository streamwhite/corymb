import { describe, expect, it } from "bun:test";
import {
  AUTH_PASSKEY_DELETE_PASSKEY_PATH,
  AUTH_PASSKEY_GENERATE_AUTHENTICATE_OPTIONS_PATH,
  AUTH_PASSKEY_GENERATE_REGISTER_OPTIONS_PATH,
  AUTH_PASSKEY_LIST_USER_PASSKEYS_PATH,
} from "@/constants/better-auth.js";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { signupUser } from "./helpers/auth-flow.js";

const validPassword = "x".repeat(MIN_PASSWORD_LENGTH);

describe("passkey auth", () => {
  it("passkey plugin is wired and table exists", async () => {
    const { sql } = await createMemoryApp();
    const rows = (await sql.unsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='passkey'",
    )) as { name: string }[];
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("passkey");
  });

  it("GET /passkey/list-user-passkeys unauthenticated => 401", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(AUTH_PASSKEY_LIST_USER_PASSKEYS_PATH, {
      method: "GET",
    });
    expect(res.status).toBe(401);
  });

  it("GET /passkey/generate-register-options unauthenticated => 401", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(
      AUTH_PASSKEY_GENERATE_REGISTER_OPTIONS_PATH,
      { method: "GET" },
    );
    expect(res.status).toBe(401);
  });

  it("GET /passkey/generate-authenticate-options unauthenticated => 200 with rpId and challenge", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(
      AUTH_PASSKEY_GENERATE_AUTHENTICATE_OPTIONS_PATH,
      { method: "GET" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rpId: string; challenge: string };
    expect(body.rpId).toBe("127.0.0.1");
    expect(typeof body.challenge).toBe("string");
    expect(body.challenge.length).toBeGreaterThan(0);
  });

  it("GET /passkey/generate-register-options authenticated => 200 with rp and challenge", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "pk-register@example.com",
      username: "pk_register_user",
      password: validPassword,
    });
    expect(signed.token).toBeTruthy();

    const res = await app.request(
      AUTH_PASSKEY_GENERATE_REGISTER_OPTIONS_PATH,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${signed.token}` },
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rp: { id: string; name: string };
      user: { id: string };
      excludeCredentials: unknown[];
      challenge: string;
    };
    expect(body.rp.id).toBe("127.0.0.1");
    expect(typeof body.challenge).toBe("string");
    expect(body.challenge.length).toBeGreaterThan(0);
    expect(Array.isArray(body.excludeCredentials)).toBe(true);
    expect(body.user.id).toBeTruthy();
  });
});