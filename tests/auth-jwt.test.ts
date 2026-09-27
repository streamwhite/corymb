import { describe, expect, it } from "bun:test";
import { buildPublicJwks } from "@/auth/jwks.js";
import {
  AUTH_JWKS_PATH,
  AUTH_JWT_ROLE_AUTHENTICATED,
  AUTH_JWT_ROLE_CLAIM,
} from "@/constants/better-auth.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { bearerHeaders, signupUser } from "./helpers/auth-flow.js";
import { PG_AVAILABLE } from "./helpers/test-db.js";

type JwtPayload = Record<string, unknown>;

function decodeJwtPayload(token: string): JwtPayload {
  const part = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as JwtPayload;
}

describe.skipIf(!PG_AVAILABLE)("auth JWT + JWKS for PostgREST", () => {
  it("issues access tokens carrying the PostgREST role claim", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "jwt-role@example.com",
      username: "jwt_role_user",
      password: "x".repeat(16),
    });
    expect(signed.token).toBeTruthy();

    const res = await app.request("/api/auth/token", {
      headers: bearerHeaders(signed.token ?? ""),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token?: string };
    expect(body.token).toBeTruthy();
    const payload = decodeJwtPayload(body.token ?? "");
    expect(payload[AUTH_JWT_ROLE_CLAIM]).toBe(AUTH_JWT_ROLE_AUTHENTICATED);
    expect(typeof payload.sub).toBe("string");
  });

  it("exposes a public JWKS with key ids via the auth endpoint", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(AUTH_JWKS_PATH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keys?: Array<{ kid?: string }> };
    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys?.length).toBeGreaterThan(0);
    expect(typeof body.keys?.[0]?.kid).toBe("string");
  });

  it("builds the JWKS document directly from the auth instance", async () => {
    const { auth } = await createMemoryApp();
    const jwks = await buildPublicJwks(auth);
    expect(jwks.keys.length).toBeGreaterThan(0);
    expect(jwks.keys[0]).toHaveProperty("kid");
  });
});
