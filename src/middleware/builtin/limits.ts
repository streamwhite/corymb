import { RequestTimeoutError, UriTooLongError } from "@/errors/app-error.js";
import type { Middleware } from "@/middleware/middleware-types.js";

/**
 * Fails the request after `ms` if the handler has not produced a response.
 * The underlying work is not cancelled, but the client is not left waiting.
 */
export function withRequestTimeout(ms: number): Middleware {
  return async (_ctx, next) => {
    const work = next();
    work.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new RequestTimeoutError()), ms);
    });
    try {
      return await Promise.race([work, timedOut]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  };
}

/** Rejects requests whose full URL (including query) exceeds `max` characters. */
export function withMaxUrlLength(max: number): Middleware {
  return (ctx, next) => {
    if (ctx.url.href.length > max) {
      throw new UriTooLongError();
    }
    return next();
  };
}
