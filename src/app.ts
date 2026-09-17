import type { Serve, SQL } from "bun";
import { openAuthDatabase } from "@/auth/auth-database.js";
import {
  type BetterAuthInstance,
  createBetterAuth,
} from "@/auth/better-auth.js";
import { blockRequestIfBot } from "@/bot/bot-guard.js";
import type { Cache } from "@/cache/cache-types.js";
import { closeCacheBundle, createCacheBundle } from "@/cache/client.js";
import {
  DEFAULT_DOCS_ACCESS_MODE,
  type DocsAccessMode,
} from "@/constants/docs-access.js";
import {
  HTTP_STATUS_INTERNAL,
  HTTP_STATUS_NOT_FOUND,
} from "@/constants/http-status.js";
import { MSG_HTTP_NOT_FOUND, MSG_INTERNAL } from "@/constants/messages.js";
import { resolveRedisUrlFromEnv } from "@/constants/redis.js";
import { closeDbBundle, createDbBundle, type DbOptions } from "@/db/client.js";
import {
  withSecurityHeaders,
  withSecurityHeadersFromRequest,
} from "@/http/security-headers.js";
import type { Mailer } from "@/mail/mailer-types.js";
import { resolveMailerFromEnv } from "@/mail/resolve-mailer.js";
import { type EventBus } from "@/realtime/event-bus.js";
import { createDefaultEventBus } from "@/realtime/redis-event-bus.js";
import { resolveUploadRoot } from "@/runtime/resolve-upload-dir.js";
import { buildServeRoutes } from "@/server/serve-routes.js";

export type CreateAppOptions = DbOptions & {
  docsAccess?: DocsAccessMode;
  /** Override upload root (absolute or cwd-relative); else `UPLOAD_DIR` env; else default under cwd. */
  uploadDir?: string;
  /** Optional mailer (defaults to console mailer via env). */
  mailer?: Mailer;
  /** Cache override (defaults to Redis via `REDIS_URL`). Use `createMemoryCache()` for local/tests. */
  cache?: Cache;
  /** Override Redis URL when creating the default cache bundle. */
  redisUrl?: string;
  /** Override Better Auth secret (tests). */
  authSecret?: string;
  /** Override Better Auth base URL (tests). */
  authBaseURL?: string;
  /** Override Better Auth trusted origins (tests). */
  authTrustedOrigins?: string[];
  /** Override event bus (tests); defaults to Redis pub/sub with memory fallback. */
  events?: EventBus;
  /** Extra `Bun.serve` routes merged after built-ins (consumer paths win on conflict). */
  routes?: Serve.Routes<unknown, string>;
};

export type AppInstance = {
  routes: Serve.Routes<unknown, string>;
  fetchNotFound: (req: Request) => Response;
  onServeError: (err: unknown) => Response | Promise<Response>;
  sql: SQL;
  cache: Cache;
  auth: BetterAuthInstance;
  events: EventBus;
  close: () => Promise<void>;
};

function fetchNotFound(req: Request): Response {
  const blocked = blockRequestIfBot(req);
  if (blocked !== null) {
    return blocked;
  }
  const res = Response.json(
    { error: MSG_HTTP_NOT_FOUND },
    { status: HTTP_STATUS_NOT_FOUND },
  );
  return withSecurityHeadersFromRequest(res, req, "api");
}

function onServeError(err: unknown): Response {
  console.error(err);
  const res = Response.json(
    { error: MSG_INTERNAL },
    { status: HTTP_STATUS_INTERNAL },
  );
  return withSecurityHeaders(res, "api", null);
}

export async function createApp(
  options?: CreateAppOptions,
): Promise<AppInstance> {
  const [bundle, cacheBundle, eventsBundle] = await Promise.all([
    createDbBundle(options),
    options?.cache !== undefined
      ? Promise.resolve({ cache: options.cache, close: () => {} })
      : createCacheBundle({ redisUrl: options?.redisUrl }),
    options?.events !== undefined
      ? Promise.resolve({ bus: options.events, owned: false })
      : createDefaultEventBus({
          url: options?.redisUrl ?? resolveRedisUrlFromEnv(),
        }).then(({ bus }) => ({ bus, owned: true })),
  ]);
  const authDatabase = openAuthDatabase({
    dialect: bundle.dialect,
    sqlitePath: bundle.sqlitePath,
    pgUrl: bundle.pgUrl,
  });
  const docsAccess = options?.docsAccess ?? DEFAULT_DOCS_ACCESS_MODE;
  const uploadDir = resolveUploadRoot({ uploadDir: options?.uploadDir });
  const mailer = options?.mailer ?? resolveMailerFromEnv();
  const auth = createBetterAuth({
    database: authDatabase.database,
    cache: cacheBundle.cache,
    mailer,
    secret: options?.authSecret,
    baseURL: options?.authBaseURL,
    trustedOrigins: options?.authTrustedOrigins,
  });
  const builtInRoutes = buildServeRoutes(
    {
      sql: bundle.sql,
      uploadDir,
      mailer,
      cache: cacheBundle.cache,
      auth,
      events: eventsBundle.bus,
    },
    { docsAccess },
  );
  return {
    routes: {
      ...builtInRoutes,
      ...(options?.routes ?? {}),
    },
    fetchNotFound,
    onServeError,
    sql: bundle.sql,
    cache: cacheBundle.cache,
    auth,
    events: eventsBundle.bus,
    close: async () => {
      if (eventsBundle.owned) {
        await eventsBundle.bus.close().catch((err: unknown) =>
          console.error("[events] close failed:", err),
        );
      }
      await authDatabase.close();
      await closeDbBundle(bundle);
      closeCacheBundle(cacheBundle);
    },
  };
}
