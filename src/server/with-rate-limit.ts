import { HEADER_RETRY_AFTER } from "@/constants/http-security.js";
import { HTTP_STATUS_TOO_MANY_REQUESTS } from "@/constants/http-status.js";
import { MSG_RATE_LIMITED } from "@/constants/messages.js";
import type { RateLimitStrategy } from "@/constants/rate-limit.js";
import { jsonApiResponse } from "@/http/json-response.js";
import {
  createRateLimiter,
  rateLimitClientKey,
  type RateLimiter,
} from "@/http/rate-limit.js";

export type AnyRouteHandler = (req: Request) => Response | Promise<Response>;

/**
 * Shared default limiter used when a handler is not given one explicitly. Uses
 * Redis when `REDIS_URL` is set, else an in-memory limiter.
 */
let defaultLimiter: RateLimiter | null = null;

function getDefaultLimiter(): RateLimiter {
  defaultLimiter ??= createRateLimiter({
    redisUrl: process.env.REDIS_URL ?? process.env.VALKEY_URL,
  });
  return defaultLimiter;
}

function rateLimitedResponse(req: Request, retryAfterSec: number): Response {
  return jsonApiResponse(
    { error: MSG_RATE_LIMITED },
    {
      status: HTTP_STATUS_TOO_MANY_REQUESTS,
      headers: { [HEADER_RETRY_AFTER]: String(retryAfterSec) },
    },
    new URL(req.url),
  );
}

/**
 * Wrap a `Bun.serve` route handler in a fixed-window rate limit. Pass a
 * `RateLimiter` (app-bound, Redis-backed) or omit it to use the shared default.
 */
export function withRateLimit<H extends AnyRouteHandler>(
  strategy: RateLimitStrategy,
  handler: H,
  limiter?: RateLimiter,
): AnyRouteHandler {
  return async (req) => {
    const active = limiter ?? getDefaultLimiter();
    const slot = await active.check(strategy, rateLimitClientKey(req.headers));
    if (!slot.ok) {
      return rateLimitedResponse(req, slot.retryAfterSec);
    }
    return handler(req);
  };
}

/** Test-only: rebuild the shared default limiter (e.g. after env changes). */
export function resetDefaultRateLimiterForTests(): void {
  defaultLimiter?.close();
  defaultLimiter = null;
}
