import type {
  Middleware,
  MiddlewareContext,
  NextFunction,
} from "@/middleware/middleware-types.js";

/** Identity middleware; useful as a base or in tests. */
export const passthrough: Middleware = (_ctx, next) => next();

/**
 * Composes middleware left-to-right: the first runs outermost and calls `next`
 * to invoke the rest. Returns a function that takes the context and the
 * terminal handler (which produces the response).
 */
export function compose(
  middlewares: Middleware[],
  handler: (ctx: MiddlewareContext) => Response | Promise<Response>,
): (ctx: MiddlewareContext) => Promise<Response> {
  return async (ctx) => {
    let index = -1;
    const dispatch = async (position: number): Promise<Response> => {
      if (position <= index) {
        throw new Error("next() called multiple times in middleware chain");
      }
      index = position;
      const middleware = middlewares[position];
      if (middleware === undefined) {
        return handler(ctx);
      }
      const next: NextFunction = () => dispatch(position + 1);
      return middleware(ctx, next);
    };
    return dispatch(0);
  };
}

/** Builds a single handler from a middleware list and a terminal handler. */
export function createHandler(
  middlewares: Middleware[],
  handler: (ctx: MiddlewareContext) => Response | Promise<Response>,
): (ctx: MiddlewareContext) => Promise<Response> {
  return compose(middlewares, handler);
}
