import type { Logger } from "@/observability/logger.js";
import type { Cache } from "@/cache/cache-types.js";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import type { ObjectStorage } from "@/storage/storage-types.js";
import type { PostgrestClient } from "@/data/postgrest-client.js";

/**
 * Shared per-request context. Middleware may attach values (e.g. parsed body,
 * session) that later middleware and the handler can read.
 */
export type ContextData = Record<string, unknown>;

export type MiddlewareContext = {
  readonly req: Request;
  readonly url: URL;
  readonly requestId: string;
  readonly logger: Logger;
  cache: Cache;
  auth: BetterAuthInstance;
  storage: ObjectStorage;
  /** Present when `POSTGREST_URL` (or `data`) is configured. */
  data?: PostgrestClient;
  /** Mutable bag for middleware-provided values. */
  readonly state: ContextData;
  /** The outermost response currently being composed. */
  response?: Response;
};

export type NextFunction = () => Promise<Response>;

/** A middleware wraps a `next` call, optionally short-circuiting with a Response. */
export type Middleware = (
  ctx: MiddlewareContext,
  next: NextFunction,
) => Response | Promise<Response>;
