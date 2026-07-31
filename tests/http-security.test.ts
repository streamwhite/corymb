import { describe, expect, it } from "bun:test";
import {
  DOCS_ACCESS_MODE_DEVELOPMENT,
  DOCS_ACCESS_MODE_PRODUCTION,
} from "@/constants/docs-access.js";
import {
  HEADER_CONTENT_SECURITY_POLICY,
  HEADER_REFERRER_POLICY,
  HEADER_RETRY_AFTER,
  HEADER_X_CONTENT_TYPE_OPTIONS,
  HEADER_X_FRAME_OPTIONS,
  MAX_JSON_BODY_BYTES,
} from "@/constants/http-security.js";
import { HTTP_STATUS_PAYLOAD_TOO_LARGE } from "@/constants/http-status.js";
import {
  MSG_HTTP_NOT_FOUND,
  MSG_PAYLOAD_TOO_LARGE,
  MSG_RATE_LIMITED,
} from "@/constants/messages.js";
import {
  RATE_LIMIT_STRATEGY_RELAXED,
  RATE_LIMIT_STRATEGY_STRICT,
} from "@/constants/rate-limit.js";
import {
  BA_SIGN_IN_PATH,
} from "./helpers/auth-flow.js";
import {
  DOCS_BASE_PATH,
  HEALTH_BASE_PATH,
} from "@/constants/routes.js";
import { setRateLimitMaxOverrideForTests } from "@/http/rate-limit.js";
import { createMemoryApp } from "./helpers/app-memory.js";

describe("http security", () => {
  it("adds common security headers on health JSON", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(HEALTH_BASE_PATH);
    expect(res.headers.get(HEADER_X_CONTENT_TYPE_OPTIONS)).toBe("nosniff");
    expect(res.headers.get(HEADER_X_FRAME_OPTIONS)).toBe("DENY");
    expect(res.headers.get(HEADER_REFERRER_POLICY)).toBeTruthy();
  });

  it("adds CSP on HTML docs when allowed", async () => {
    const { app } = await createMemoryApp({
      docsAccess: DOCS_ACCESS_MODE_DEVELOPMENT,
    });
    const res = await app.request(DOCS_BASE_PATH);
    const csp = res.headers.get(HEADER_CONTENT_SECURITY_POLICY) ?? "";
    expect(csp).toContain("connect-src 'self'");
  });

  it("allows same-origin fetch from auth UI CSP", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request("/ui");
    const csp = res.headers.get(HEADER_CONTENT_SECURITY_POLICY) ?? "";
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("script-src 'unsafe-inline'");
  });

  it("adds security headers on JSON docs 404", async () => {
    const { app } = await createMemoryApp({
      docsAccess: DOCS_ACCESS_MODE_PRODUCTION,
    });
    const res = await app.request(DOCS_BASE_PATH);
    expect(res.status).toBe(404);
    expect(res.headers.get(HEADER_X_CONTENT_TYPE_OPTIONS)).toBe("nosniff");
  });

  it("returns 413 when JSON body exceeds byte cap", async () => {
    const { app } = await createMemoryApp();
    const filler = "a".repeat(MAX_JSON_BODY_BYTES + 2);
    const res = await app.request(BA_SIGN_IN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${filler.slice(0, 120)}@example.invalid`,
        password: filler,
      }),
    });
    expect(res.status).toBe(HTTP_STATUS_PAYLOAD_TOO_LARGE);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_PAYLOAD_TOO_LARGE);
  });

  it("returns 429 with Retry-After when strict rate limit exceeded on auth route", async () => {
    setRateLimitMaxOverrideForTests(RATE_LIMIT_STRATEGY_STRICT, 2);
    try {
      const { app } = await createMemoryApp();
      const clientIp = "203.0.113.55";
      const init = {
        method: "POST" as const,
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": clientIp,
        },
        body: JSON.stringify({ not: "signin" }),
      };
      const r1 = await app.request(BA_SIGN_IN_PATH, init);
      const r2 = await app.request(BA_SIGN_IN_PATH, init);
      const r3 = await app.request(BA_SIGN_IN_PATH, init);
      expect(r1.status).not.toBe(429);
      expect(r2.status).not.toBe(429);
      expect(r3.status).toBe(429);
      const j = (await r3.json()) as { error?: string };
      expect(j.error).toBe(MSG_RATE_LIMITED);
      expect(r3.headers.get(HEADER_RETRY_AFTER)).toBeTruthy();
    } finally {
      setRateLimitMaxOverrideForTests(RATE_LIMIT_STRATEGY_STRICT, undefined);
    }
  });

  it("relaxed strategy allows more requests than strict (health vs signin)", async () => {
    setRateLimitMaxOverrideForTests(RATE_LIMIT_STRATEGY_STRICT, 1);
    setRateLimitMaxOverrideForTests(RATE_LIMIT_STRATEGY_RELAXED, 5);
    try {
      const { app } = await createMemoryApp();
      const clientIp = "203.0.113.66";
      const headers = { "X-Forwarded-For": clientIp };
      const strictA = await app.request(BA_SIGN_IN_PATH, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const strictB = await app.request(BA_SIGN_IN_PATH, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(strictA.status).not.toBe(429);
      expect(strictB.status).toBe(429);
      const r1 = await app.request(HEALTH_BASE_PATH, { headers });
      const r2 = await app.request(HEALTH_BASE_PATH, { headers });
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
    } finally {
      setRateLimitMaxOverrideForTests(RATE_LIMIT_STRATEGY_STRICT, undefined);
      setRateLimitMaxOverrideForTests(RATE_LIMIT_STRATEGY_RELAXED, undefined);
    }
  });

  it("applies security headers on fetch fallback 404", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request("/no-such-route");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_HTTP_NOT_FOUND);
    expect(res.headers.get(HEADER_X_CONTENT_TYPE_OPTIONS)).toBe("nosniff");
  });
});
