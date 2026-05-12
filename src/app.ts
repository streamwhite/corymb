import type { Serve, SQL } from "bun";
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
};

export type AppInstance = {
  routes: NonNullable<Serve["routes"]>;
  fetchNotFound: (req: Request) => Response;
  onServeError: (err: unknown) => Response | Promise<Response>;
  sql: SQL;
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
  const bundle = await createDbBundle(options);
  const docsAccess = options?.docsAccess ?? DEFAULT_DOCS_ACCESS_MODE;
  const uploadDir = resolveUploadRoot({ uploadDir: options?.uploadDir });
  const mailer = options?.mailer ?? resolveMailerFromEnv();
  return {
    routes: buildServeRoutes(
      { sql: bundle.sql, uploadDir, mailer },
      { docsAccess },
    ),
    fetchNotFound,
    onServeError,
    sql: bundle.sql,
    close: () => closeDbBundle(bundle),
  };
}
