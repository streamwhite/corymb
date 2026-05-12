import { HEADER_RETRY_AFTER } from "@/constants/http-security.js";
import { HTTP_STATUS_TOO_MANY_REQUESTS } from "@/constants/http-status.js";
import { MSG_RATE_LIMITED } from "@/constants/messages.js";
import type { RateLimitStrategy } from "@/constants/rate-limit.js";
import { jsonApiResponse } from "@/http/json-response.js";
import { rateLimitClientKey, takeRateLimitSlot } from "@/http/rate-limit.js";

export type AnyRouteHandler = (req: Request) => Response | Promise<Response>;

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

/** Wrap a `Bun.serve` route handler in a per-strategy sliding-window rate limit. */
export function withRateLimit<H extends AnyRouteHandler>(
  strategy: RateLimitStrategy,
  handler: H,
): AnyRouteHandler {
  return (req) => {
    const slot = takeRateLimitSlot(strategy, rateLimitClientKey(req.headers));
    if (!slot.ok) {
      return rateLimitedResponse(req, slot.retryAfterSec);
    }
    return handler(req);
  };
}
