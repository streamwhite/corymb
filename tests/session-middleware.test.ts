import { describe, expect, it } from "bun:test";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import {
  bearerToken,
  getOptionalSession,
  readSession,
  readUser,
  resolveActorId,
  withSession,
} from "@/auth/session-middleware.js";
import { UnauthorizedError } from "@/errors/app-error.js";
import { compose } from "@/middleware/compose.js";
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

type FakeSession = {
  user: { id: string; email: string; name?: string | null };
  session: { id: string; token: string; expiresAt: Date };
};

function fakeAuth(session: FakeSession | null): BetterAuthInstance {
  return {
    api: { getSession: async () => session },
  } as unknown as BetterAuthInstance;
}

const SAMPLE_SESSION: FakeSession = {
  user: { id: "user-1", email: "fake@example.com", name: "Fake" },
  session: { id: "s-1", token: "tok", expiresAt: new Date() },
};

describe("withSession", () => {
  it("rejects when there is no session", async () => {
    const handler = compose([withSession()], async () => new Response("ok"));
    await expect(
      handler(ctxFor(new Request("http://x.test/me"), fakeAuth(null))),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("attaches session and user to state", async () => {
    const handler = compose([withSession()], async (ctx) => {
      expect(readSession(ctx)?.session.id).toBe("s-1");
      expect(readUser(ctx)?.id).toBe("user-1");
      return Response.json(ctx.state.session);
    });
    const res = await handler(
      ctxFor(new Request("http://x.test/me"), fakeAuth(SAMPLE_SESSION)),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { id: "user-1" } });
  });

  it("honors a custom state key", async () => {
    const handler = compose([withSession("auth")], async (ctx) =>
      Response.json({ has: ctx.state.auth !== undefined }),
    );
    const res = await handler(
      ctxFor(new Request("http://x.test/me"), fakeAuth(SAMPLE_SESSION)),
    );
    expect(await res.json()).toEqual({ has: true });
  });
});

describe("resolveActorId", () => {
  it("returns the user id for a session and undefined otherwise", async () => {
    const withUser = compose([], async (ctx) =>
      Response.json({ id: await resolveActorId(ctx) }),
    );
    const res = await withUser(
      ctxFor(new Request("http://x.test/me"), fakeAuth(SAMPLE_SESSION)),
    );
    expect(await res.json()).toEqual({ id: "user-1" });

    const anonymous = compose([], async (ctx) =>
      Response.json({ id: (await resolveActorId(ctx)) ?? null }),
    );
    const anonRes = await anonymous(
      ctxFor(new Request("http://x.test/me"), fakeAuth(null)),
    );
    expect(await anonRes.json()).toEqual({ id: null });
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
