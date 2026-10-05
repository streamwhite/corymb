import { describe, expect, it } from "bun:test";
import { HEADER_RETRY_AFTER } from "@/constants/http-security.js";
import { HTTP_STATUS_TOO_MANY_REQUESTS } from "@/constants/http-status.js";
import { RATE_LIMIT_STRATEGY_RELAXED } from "@/constants/rate-limit.js";
import type { RateLimiter } from "@/http/rate-limit.js";
import {
  resetDefaultRateLimiterForTests,
  withRateLimit,
} from "@/server/with-rate-limit.js";

function fixedLimiter(result: Awaited<ReturnType<RateLimiter["check"]>>): RateLimiter {
  return {
    check: async () => result,
    close: () => {},
  };
}

describe("withRateLimit", () => {
  it("calls the handler when the limiter allows the request", async () => {
    const handler = withRateLimit(
      RATE_LIMIT_STRATEGY_RELAXED,
      () => new Response("ok"),
      fixedLimiter({ ok: true }),
    );
    const res = await handler(new Request("http://x.test/"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("returns 429 with Retry-After when the limiter rejects", async () => {
    const handler = withRateLimit(
      RATE_LIMIT_STRATEGY_RELAXED,
      () => new Response("should not run"),
      fixedLimiter({ ok: false, retryAfterSec: 42 }),
    );
    const res = await handler(new Request("http://x.test/"));
    expect(res.status).toBe(HTTP_STATUS_TOO_MANY_REQUESTS);
    expect(res.headers.get(HEADER_RETRY_AFTER)).toBe("42");
    expect(await res.text()).not.toContain("should not run");
  });

  it("resets the shared default limiter without throwing", () => {
    expect(() => resetDefaultRateLimiterForTests()).not.toThrow();
  });
});
