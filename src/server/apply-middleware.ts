import type { Serve } from "bun";
import type { CorsConfig } from "@/constants/cors.js";
import { applyCors, corsPreflight } from "@/http/cors.js";
import type { Middleware } from "@/middleware/middleware-types.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import type { Logger } from "@/observability/logger.js";
import { createHandler } from "@/middleware/compose.js";

type RouteHandler = (
  req: Request,
  ctx?: MiddlewareContext,
) => Response | Promise<Response>;

export type MiddlewareOptions = {
  cors: CorsConfig;
  logger: Logger;
  /** Middleware applied to every route, after the built-in body handling. */
  middleware?: Middleware[];
};

function corsMiddleware(cors: CorsConfig): Middleware {
  return async (ctx, next) => {
    const preflight = corsPreflight(ctx.req, cors);
    if (preflight !== null) {
      return preflight;
    }
    return applyCors(ctx.req, await next(), cors);
  };
}

/** Builds a `Bun.serve` handler that runs the request through the middleware chain. */
function runWithContext(
  handler: RouteHandler,
  options: MiddlewareOptions,
  createContext: (req: Request) => MiddlewareContext,
): (req: Request) => Promise<Response> {
  const userMiddleware = options.middleware ?? [];
  return (req) =>
    createHandler(
      [corsMiddleware(options.cors), ...userMiddleware],
      (ctx) => handler(ctx.req, ctx),
    )(createContext(req));
}

/** Wraps every route handler with the middleware chain. */
export function applyRouteMiddleware(
  routes: Serve.Routes<unknown, string>,
  options: MiddlewareOptions,
  createContext: (req: Request) => MiddlewareContext,
): Serve.Routes<unknown, string> {
  const wrapped: Record<string, Record<string, unknown>> = {};
  for (const [path, route] of Object.entries(routes)) {
    const methods: Record<string, unknown> = {};
    for (const [method, handler] of Object.entries(route ?? {})) {
      methods[method] =
        typeof handler === "function"
          ? runWithContext(handler as RouteHandler, options, createContext)
          : handler;
    }
    methods.OPTIONS = runWithContext(
      () => new Response(null, { status: 204 }),
      options,
      createContext,
    );
    wrapped[path] = methods;
  }
  return wrapped as unknown as Serve.Routes<unknown, string>;
}

/** Wraps the fallback (`fetch`) handler with the same middleware chain. */
export function wrapFallbackHandler(
  handler: RouteHandler,
  options: MiddlewareOptions,
  createContext: (req: Request) => MiddlewareContext,
): (req: Request) => Promise<Response> {
  return runWithContext(handler, options, createContext);
}
