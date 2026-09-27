import { describe, expect, it } from "bun:test";
import { bearerToken, getOptionalSession } from "@/auth/session-middleware.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import { createLogger } from "@/observability/logger.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { signupUser } from "./helpers/auth-flow.js";
import { PG_AVAILABLE } from "./helpers/test-db.js";

function ctxFor(req: Request, auth: MiddlewareContext["auth"]): MiddlewareContext {
  return {
    req,
    url: new URL(req.url),
    requestId: "r1",
    logger: createLogger({}, { level: "error", writer: () => {} }),
    cache: {} as MiddlewareContext["cache"],
    auth,
    storage: {} as MiddlewareContext["storage"],
    state: {},
  };
}

describe("bearerToken", () => {
  it("extracts a bearer token", () => {
    expect(
      bearerToken(new Request("http://x.test", { headers: { Authorization: "Bearer abc" } })),
    ).toBe("abc");
    expect(bearerToken(new Request("http://x.test"))).toBeUndefined();
  });
});

describe.skipIf(!PG_AVAILABLE)("session middleware", () => {
  it("loads the session from a bearer token", async () => {
    const { app } = await createMemoryApp();
    const signed = await signupUser(app.request, {
      email: "session-mw@example.com",
      username: "session_mw_user",
      password: "x".repeat(16),
    });
    const req = new Request("http://x.test/me", {
      headers: { Authorization: `Bearer ${signed.token ?? ""}` },
    });
    const session = await getOptionalSession(ctxFor(req, app.instance.auth));
    expect(session?.user.email).toBe("session-mw@example.com");
  });

  it("returns null without credentials", async () => {
    const { app } = await createMemoryApp();
    const session = await getOptionalSession(
      ctxFor(new Request("http://x.test/me"), app.instance.auth),
    );
    expect(session).toBeNull();
  });
});
