import type { Serve, SQL } from "bun";
import {
  createBetterAuth,
  openAuthSqlite,
  type BetterAuthInstance,
} from "@/auth/better-auth.js";
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
import { closeDbBundle, createDbBundle, type DbOptions } from "@/db/client.js";
import {
  withSecurityHeaders,
  withSecurityHeadersFromRequest,
} from "@/http/security-headers.js";
import type { Mailer } from "@/mail/mailer-types.js";
import { resolveMailerFromEnv } from "@/mail/resolve-mailer.js";
import { resolveUploadRoot } from "@/runtime/resolve-upload-dir.js";
import { buildServeRoutes } from "@/server/serve-routes.js";

export type CreateAppOptions = DbOptions & {
  docsAccess?: DocsAccessMode;
  /** Override upload root (absolute or cwd-relative); else `UPLOAD_DIR` env; else default under cwd. */
  uploadDir?: string;
  /** Optional mailer (defaults to console mailer via env). */
  mailer?: Mailer;
  /** Test-only cache override (defaults to Redis via `REDIS_URL`). */
  cache?: Cache;
  /** Override Redis URL when creating the default cache bundle. */
  redisUrl?: string;
  /** Override Better Auth secret (tests). */
  authSecret?: string;
  /** Override Better Auth base URL (tests). */
  authBaseURL?: string;
  /** Override trusted origins (tests). */
  authTrustedOrigins?: string[];
};

export type AppInstance = {
  routes: NonNullable<Serve["routes"]>;
  fetchNotFound: (req: Request) => Response;
  onServeError: (err: unknown) => Response | Promise<Response>;
  sql: SQL;
  cache: Cache;
  auth: BetterAuthInstance;
  close: () => Promise<void>;
};

function fetchNotFound(req: Request): Response {
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
  const [bundle, cacheBundle] = await Promise.all([
    createDbBundle(options),
    options?.cache !== undefined
      ? Promise.resolve({ cache: options.cache, close: () => {} })
      : createCacheBundle({ redisUrl: options?.redisUrl }),
  ]);
  const authSqlite = openAuthSqlite(bundle.databasePath);
  const docsAccess = options?.docsAccess ?? DEFAULT_DOCS_ACCESS_MODE;
  const uploadDir = resolveUploadRoot({ uploadDir: options?.uploadDir });
  const mailer = options?.mailer ?? resolveMailerFromEnv();
  const auth = createBetterAuth({
    database: authSqlite.database,
    cache: cacheBundle.cache,
    mailer,
    secret: options?.authSecret,
    baseURL: options?.authBaseURL,
    trustedOrigins: options?.authTrustedOrigins,
  });
  return {
    routes: buildServeRoutes(
      {
        sql: bundle.sql,
        uploadDir,
        mailer,
        cache: cacheBundle.cache,
        auth,
      },
      { docsAccess },
    ),
    fetchNotFound,
    onServeError,
    sql: bundle.sql,
    cache: cacheBundle.cache,
    auth,
    close: async () => {
      authSqlite.close();
      await closeDbBundle(bundle);
      closeCacheBundle(cacheBundle);
    },
  };
}
