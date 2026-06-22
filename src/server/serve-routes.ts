import type { Serve, SQL } from "bun";
import {
  DEFAULT_DOCS_ACCESS_MODE,
  type DocsAccessMode,
} from "@/constants/docs-access.js";
import { HEALTH_OK_BODY } from "@/constants/health.js";
import { HTTP_STATUS_NOT_FOUND } from "@/constants/http-status.js";
import { MSG_HTTP_NOT_FOUND } from "@/constants/messages.js";
import {
  RATE_LIMIT_STRATEGY_RELAXED,
  RATE_LIMIT_STRATEGY_STANDARD,
  RATE_LIMIT_STRATEGY_STRICT,
} from "@/constants/rate-limit.js";
import {
  AUTH_FORGOT_PASSWORD_PATH,
  AUTH_REFRESH_PATH,
  AUTH_RESET_PASSWORD_PATH,
  AUTH_SEND_VERIFICATION_PATH,
  AUTH_SIGNIN_PATH,
  AUTH_SIGNOUT_PATH,
  AUTH_SIGNUP_PATH,
  AUTH_VERIFY_EMAIL_PATH,
  DOCS_BASE_PATH,
  HEALTH_BASE_PATH,
  UI_AUTH_BASE_PATH,
  UPLOAD_BASE_PATH,
} from "@/constants/routes.js";
import type { Cache } from "@/cache/cache-types.js";
import { withSecurityHeadersFromRequest } from "@/http/security-headers.js";
import type { Mailer } from "@/mail/mailer-types.js";
import { apiDocsResponse } from "@/server/api-docs.js";
import {
  handleAuthRefresh,
  handleAuthSignin,
  handleAuthSignout,
  handleAuthSignup,
  handleForgotPassword,
  handleResetPassword,
  handleSendVerification,
  handleVerifyEmail,
} from "@/server/auth-route-handlers.js";
import { isDocsRouteAllowed } from "@/server/docs-route.js";
import { handleFileUpload } from "@/server/upload-route-handler.js";
import { withRateLimit } from "@/server/with-rate-limit.js";
import { buildAuthPageHtml } from "@/ui/auth-page-html.js";

const MIME_HTML_UTF8 = "text/html; charset=utf-8" as const;

export type RouteBundle = {
  sql: SQL;
  uploadDir: string;
  mailer: Mailer;
  cache: Cache;
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

export function buildServeRoutes(
  bundle: RouteBundle,
  opts?: ServeRoutesOptions,
): NonNullable<Serve["routes"]> {
  const { sql, uploadDir, mailer, cache } = bundle;
  const docsAccess = opts?.docsAccess ?? DEFAULT_DOCS_ACCESS_MODE;
  const strict = RATE_LIMIT_STRATEGY_STRICT;
  const standard = RATE_LIMIT_STRATEGY_STANDARD;
  const relaxed = RATE_LIMIT_STRATEGY_RELAXED;
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
    [AUTH_SIGNUP_PATH]: {
      POST: withRateLimit(strict, (req) => handleAuthSignup(req, sql, cache)),
    },
    [AUTH_SIGNIN_PATH]: {
      POST: withRateLimit(strict, (req) => handleAuthSignin(req, sql, cache)),
    },
    [AUTH_SIGNOUT_PATH]: {
      POST: withRateLimit(standard, (req) =>
        handleAuthSignout(req, sql, cache),
      ),
    },
    [AUTH_REFRESH_PATH]: {
      POST: withRateLimit(strict, (req) => handleAuthRefresh(req, sql, cache)),
    },
    [AUTH_FORGOT_PASSWORD_PATH]: {
      POST: withRateLimit(strict, (req) =>
        handleForgotPassword(req, sql, mailer, cache),
      ),
    },
    [AUTH_RESET_PASSWORD_PATH]: {
      POST: withRateLimit(strict, (req) =>
        handleResetPassword(req, sql, cache),
      ),
    },
    [AUTH_SEND_VERIFICATION_PATH]: {
      POST: withRateLimit(strict, (req) =>
        handleSendVerification(req, sql, mailer, cache),
      ),
    },
    [AUTH_VERIFY_EMAIL_PATH]: {
      GET: withRateLimit(standard, (req) =>
        handleVerifyEmail(req, sql, cache),
      ),
    },
    [UPLOAD_BASE_PATH]: {
      POST: withRateLimit(standard, (req) =>
        handleFileUpload(req, { uploadDir }),
      ),
    },
  };
}
