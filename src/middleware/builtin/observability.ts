import { HEADER_REQUEST_ID } from "@/constants/observability.js";
import { toErrorResponse } from "@/errors/to-response.js";
import type { Middleware } from "@/middleware/middleware-types.js";
import { resolveRequestId } from "@/observability/request-id.js";

const CLIENT_ERROR_THRESHOLD = 400;
const SERVER_ERROR_THRESHOLD = 500;

/** Adds `x-request-id` to the context and the response. */
export function withRequestId(): Middleware {
  return async (ctx, next) => {
    const requestId = resolveRequestId(ctx.req);
    const res = await next();
    res.headers.set(HEADER_REQUEST_ID, requestId);
    (ctx as { requestId: string }).requestId = requestId;
    return res;
  };
}

/** Logs one structured access line per request with timing. */
export function withAccessLog(): Middleware {
  return async (ctx, next) => {
    const started = performance.now();
    const res = await next();
    const fields = {
      requestId: ctx.requestId,
      method: ctx.req.method,
      path: ctx.url.pathname,
      status: res.status,
      durationMs: Math.round(performance.now() - started),
    };
    if (res.status >= SERVER_ERROR_THRESHOLD) ctx.logger.error("request", fields);
    else if (res.status >= CLIENT_ERROR_THRESHOLD) ctx.logger.warn("request", fields);
    else ctx.logger.info("request", fields);
    return res;
  };
}

/** Catches thrown errors and maps them to a unified JSON response. */
export function withErrorHandler(): Middleware {
  return async (ctx, next) => {
    try {
      return await next();
    } catch (err) {
      ctx.logger.error("unhandled request error", {
        requestId: ctx.requestId,
        method: ctx.req.method,
        error: err instanceof Error ? err.message : String(err),
      });
      return toErrorResponse(err, ctx.requestId);
    }
  };
}
