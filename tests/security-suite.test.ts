import { describe, expect, it } from "bun:test";
import { HEADER_COOKIE, HEADER_SET_COOKIE } from "@/constants/http-security.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/constants/security.js";
import {
  ForbiddenError,
  RequestTimeoutError,
  UriTooLongError,
  ValidationError,
} from "@/errors/app-error.js";
import { compose } from "@/middleware/compose.js";
import { generateCsrfToken, withCsrf } from "@/http/csrf.js";
import {
  withMaxUrlLength,
  withRequestTimeout,
} from "@/middleware/builtin/limits.js";
import { withValidation } from "@/middleware/builtin/validation.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import { createLogger } from "@/observability/logger.js";
import {
  createBruteForceGuard,
  withBruteForce,
} from "@/security/brute-force.js";
import { safeFetch } from "@/security/safe-fetch.js";
import { isPathTraversal, safeJoinPath } from "@/security/sanitize.js";
import { isSafeOutboundUrl } from "@/security/ssrf.js";

function ctxFor(req: Request): MiddlewareContext {
  return {
    req,
    url: new URL(req.url),
    requestId: "r1",
    logger: createLogger({}, { level: "error", writer: () => {} }),
    cache: {} as MiddlewareContext["cache"],
    auth: {} as MiddlewareContext["auth"],
    storage: {} as MiddlewareContext["storage"],
    state: {},
  };
}

function cookieValue(res: Response, name: string): string {
  const raw = (res.headers.getSetCookie?.() ?? []).find((entry) =>
    entry.startsWith(`${name}=`),
  );
  return raw?.split(";")[0]?.split("=")[1] ?? "";
}

describe("request limits", () => {
  it("passes through fast handlers", async () => {
    const handler = compose([withRequestTimeout(50)], async () =>
      new Response("ok"),
    );
    const res = await handler(ctxFor(new Request("http://x.test/")));
    expect(res.status).toBe(200);
  });

  it("fails slow handlers with a timeout error", async () => {
    const handler = compose([withRequestTimeout(10)], () =>
      new Promise<Response>((resolve) =>
        setTimeout(() => resolve(new Response("late")), 80),
      ),
    );
    await expect(handler(ctxFor(new Request("http://x.test/")))).rejects.toBeInstanceOf(
      RequestTimeoutError,
    );
  });

  it("rejects URLs over the configured length", async () => {
    const handler = compose([withMaxUrlLength(40)], async () =>
      new Response("ok"),
    );
    await expect(
      handler(ctxFor(new Request(`http://x.test/${"a".repeat(60)}`))),
    ).rejects.toBeInstanceOf(UriTooLongError);
  });
});

describe("csrf protection", () => {
  it("generates unique url-safe tokens", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });

  it("issues a token cookie on safe requests", async () => {
    const handler = compose([withCsrf()], async () => new Response("ok"));
    const res = await handler(ctxFor(new Request("http://x.test/")));
    expect(cookieValue(res, CSRF_COOKIE_NAME).length).toBeGreaterThan(0);
  });

  it("rejects unsafe requests without a matching token", async () => {
    const handler = compose([withCsrf()], async () => new Response("ok"));
    const req = new Request("http://x.test/", { method: "POST" });
    await expect(handler(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("accepts unsafe requests that echo the cookie token", async () => {
    const token = generateCsrfToken();
    const handler = compose([withCsrf()], async () => new Response("ok"));
    const req = new Request("http://x.test/", {
      method: "POST",
      headers: {
        [HEADER_COOKIE]: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: token,
      },
    });
    const res = await handler(ctxFor(req));
    expect(res.status).toBe(200);
  });

  it("rejects unsafe requests with a mismatched token", async () => {
    const handler = compose([withCsrf()], async () => new Response("ok"));
    const req = new Request("http://x.test/", {
      method: "POST",
      headers: {
        [HEADER_COOKIE]: `${CSRF_COOKIE_NAME}=${generateCsrfToken()}`,
        [CSRF_HEADER_NAME]: generateCsrfToken(),
      },
    });
    await expect(handler(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("brute-force guard", () => {
  const options = { maxAttempts: 2, windowSeconds: 60, lockSeconds: 60 };

  it("locks a key after the threshold and unlocks on reset", async () => {
    const guard = createBruteForceGuard(options);
    expect((await guard.check("actor")).locked).toBe(false);
    await guard.recordFailure("actor");
    expect((await guard.check("actor")).locked).toBe(false);
    await guard.recordFailure("actor");
    const locked = await guard.check("actor");
    expect(locked.locked).toBe(true);
    expect(locked.retryAfterSec).toBeGreaterThan(0);
    await guard.reset("actor");
    expect((await guard.check("actor")).locked).toBe(false);
    guard.close();
  });

  it("returns 429 with Retry-After once locked", async () => {
    const guard = createBruteForceGuard(options);
    const handler = compose([withBruteForce(guard)], async () =>
      new Response("no", { status: 401 }),
    );
    const request = () =>
      handler(
        ctxFor(
          new Request("http://x.test/", {
            headers: { "x-forwarded-for": "1.2.3.4" },
          }),
        ),
      );
    await request();
    await request();
    const blocked = await request();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).not.toBeNull();
    guard.close();
  });

  it("resets the counter after a successful response", async () => {
    const guard = createBruteForceGuard({ ...options, maxAttempts: 2 });
    const middleware = withBruteForce(guard);
    const request = (status: number) =>
      compose([middleware], async () => new Response("x", { status }))(
        ctxFor(
          new Request("http://x.test/", {
            headers: { "x-forwarded-for": "9.9.9.9" },
          }),
        ),
      );
    await request(401);
    await request(200);
    await request(401);
    const afterReset = await request(401);
    expect(afterReset.status).toBe(401);
    guard.close();
  });
});

describe("input sanitization validation", () => {
  it("strips HTML from string fields before validating", async () => {
    const handler = compose(
      [
        withValidation<{ name: string; tags: string[] }>(
          (input) => input as { name: string; tags: string[] },
          { sanitize: true },
        ),
      ],
      async (ctx) => Response.json(ctx.state.input),
    );
    const req = new Request("http://x.test/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "<b>Bob</b>", tags: ["<i>x</i>"] }),
    });
    const res = await handler(ctxFor(req));
    expect(await res.json()).toEqual({ name: "Bob", tags: ["x"] });
  });

  it("leaves input untouched when sanitize is off", async () => {
    const handler = compose(
      [
        withValidation<{ name: string }>((input) => input as { name: string }),
      ],
      async (ctx) => Response.json(ctx.state.input),
    );
    const req = new Request("http://x.test/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "<b>Bob</b>" }),
    });
    const res = await handler(ctxFor(req));
    expect(await res.json()).toEqual({ name: "<b>Bob</b>" });
  });
});

describe("ssrf + path traversal guards", () => {
  it("allows public https URLs and blocks others", () => {
    expect(isSafeOutboundUrl("https://example.com/hook")).toBe(true);
    expect(isSafeOutboundUrl("http://example.com/hook")).toBe(false);
    expect(isSafeOutboundUrl("https://localhost/hook")).toBe(false);
    expect(
      isSafeOutboundUrl("https://localhost/hook", { allowLoopback: true }),
    ).toBe(true);
  });

  it("throws before fetching an unsafe URL", async () => {
    await expect(safeFetch("https://127.0.0.1/internal")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("resolves paths without escaping the root", () => {
    expect(safeJoinPath("/srv/root", "../etc/passwd")).toBeNull();
    expect(safeJoinPath("/srv/root", "a/b.txt")).toBe("/srv/root/a/b.txt");
    expect(isPathTraversal("../secrets")).toBe(true);
    expect(isPathTraversal("a/b.txt")).toBe(false);
  });
});
