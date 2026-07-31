import type { Serve, SQL } from "bun";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import { handleSessionRotate } from "@/auth/session-rotate.js";
import type { Cache } from "@/cache/cache-types.js";
import {
  AUTH_SESSION_ROTATE_PATH,
  BETTER_AUTH_BASE_PATH,
} from "@/constants/better-auth.js";
import {
  DEFAULT_DOCS_ACCESS_MODE,
  type DocsAccessMode,
} from "@/constants/docs-access.js";
import { HEALTH_OK_BODY } from "@/constants/health.js";
import {
  HEADER_CONTENT_LENGTH,
  MAX_JSON_BODY_BYTES,
} from "@/constants/http-security.js";
import {
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_PAYLOAD_TOO_LARGE,
} from "@/constants/http-status.js";
import {
  MSG_HTTP_NOT_FOUND,
  MSG_PAYLOAD_TOO_LARGE,
} from "@/constants/messages.js";
import {
  RATE_LIMIT_STRATEGY_RELAXED,
  RATE_LIMIT_STRATEGY_STANDARD,
  RATE_LIMIT_STRATEGY_STRICT,
} from "@/constants/rate-limit.js";
import {
  DOCS_BASE_PATH,
  HEALTH_BASE_PATH,
  UI_AUTH_BASE_PATH,
  UPLOAD_BASE_PATH,
} from "@/constants/routes.js";
import { withSecurityHeadersFromRequest } from "@/http/security-headers.js";
import type { Mailer } from "@/mail/mailer-types.js";
import { apiDocsResponse } from "@/server/api-docs.js";
import { isDocsRouteAllowed } from "@/server/docs-route.js";
import { handleFileUpload } from "@/server/upload-route-handler.js";
import { withRateLimit } from "@/server/with-rate-limit.js";
import { buildAuthPageHtml } from "@/ui/auth-page-html.js";

const MIME_HTML_UTF8 = "text/html; charset=utf-8" as const;

const BETTER_AUTH_WILDCARD = `${BETTER_AUTH_BASE_PATH}/*` as const;

export type RouteBundle = {
  sql: SQL;
  uploadDir: string;
  mailer: Mailer;
  cache: Cache;
  auth: BetterAuthInstance;
};

export type ServeRoutesOptions = {
  docsAccess: DocsAccessMode;
};

function docsResponse(access: DocsAccessMode): Response {
  if (!isDocsRouteAllowed(access)) {
    return Response.json(
      { error: MSG_HTTP_NOT_FOUND },
      { status: HTTP_STATUS_NOT_FOUND },
    );
  }
  return apiDocsResponse();
}

function buildDocsHandler(access: DocsAccessMode) {
  return (req: Request) =>
    withSecurityHeadersFromRequest(
      docsResponse(access),
      req,
      isDocsRouteAllowed(access) ? "html" : "api",
    );
}

function healthHandler(req: Request): Response {
  return withSecurityHeadersFromRequest(
    Response.json(HEALTH_OK_BODY),
    req,
    "api",
  );
}

function authUiHandler(req: Request): Response {
  return withSecurityHeadersFromRequest(
    new Response(buildAuthPageHtml(), {
      headers: { "Content-Type": MIME_HTML_UTF8 },
    }),
    req,
    "html",
  );
}

function rejectOversizedJson(req: Request): Response | null {
  if (req.method === "GET" || req.method === "HEAD") {
    return null;
  }
  const raw = req.headers.get(HEADER_CONTENT_LENGTH);
  if (raw === null || raw.length === 0) {
    return null;
  }
  const length = Number.parseInt(raw, 10);
  if (!Number.isFinite(length) || length <= MAX_JSON_BODY_BYTES) {
    return null;
  }
  return Response.json(
    { error: MSG_PAYLOAD_TOO_LARGE },
    { status: HTTP_STATUS_PAYLOAD_TOO_LARGE },
  );
}

function wrapAuthHandler(
  auth: BetterAuthInstance,
  strategy: typeof RATE_LIMIT_STRATEGY_STRICT,
) {
  return withRateLimit(strategy, async (req: Request) => {
    const oversized = rejectOversizedJson(req);
    if (oversized !== null) {
      return withSecurityHeadersFromRequest(oversized, req, "api");
    }
    const res = await auth.handler(req);
    return withSecurityHeadersFromRequest(res, req, "api");
  });
}

export function buildServeRoutes(
  bundle: RouteBundle,
  opts?: ServeRoutesOptions,
): NonNullable<Serve["routes"]> {
  const { uploadDir, auth } = bundle;
  const docsAccess = opts?.docsAccess ?? DEFAULT_DOCS_ACCESS_MODE;
  const strict = RATE_LIMIT_STRATEGY_STRICT;
  const standard = RATE_LIMIT_STRATEGY_STANDARD;
  const relaxed = RATE_LIMIT_STRATEGY_RELAXED;
  const authHandler = wrapAuthHandler(auth, strict);
  return {
    [DOCS_BASE_PATH]: {
      GET: withRateLimit(relaxed, buildDocsHandler(docsAccess)),
    },
    [HEALTH_BASE_PATH]: {
      GET: withRateLimit(relaxed, healthHandler),
    },
    [UI_AUTH_BASE_PATH]: {
      GET: withRateLimit(relaxed, authUiHandler),
    },
    [AUTH_SESSION_ROTATE_PATH]: {
      POST: withRateLimit(strict, async (req) => {
        const oversized = rejectOversizedJson(req);
        if (oversized !== null) {
          return withSecurityHeadersFromRequest(oversized, req, "api");
        }
        const res = await handleSessionRotate(req, auth);
        return withSecurityHeadersFromRequest(res, req, "api");
      }),
    },
    [BETTER_AUTH_BASE_PATH]: {
      GET: authHandler,
      POST: authHandler,
    },
    [BETTER_AUTH_WILDCARD]: {
      GET: authHandler,
      POST: authHandler,
    },
    [UPLOAD_BASE_PATH]: {
      POST: withRateLimit(standard, (req) =>
        handleFileUpload(req, { uploadDir }),
      ),
    },
  };
}
