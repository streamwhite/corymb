import type { Serve } from "bun";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import {
  withSensitiveOperation,
} from "@/auth/sensitive-guard.js";
import { handleSessionRotate } from "@/auth/session-rotate.js";
import { handleSensitiveVerify } from "@/auth/sensitive-verify.js";
import { createSensitiveVerifyStore } from "@/auth/sensitive-verify-store.js";
import type { Cache } from "@/cache/cache-types.js";
import { withBotDetection, type BotRouteHandler } from "@/bot/bot-guard.js";
import { robotsTxtResponse } from "@/bot/bot-response.js";
import {
  AUTH_SESSION_ROTATE_PATH,
  AUTH_SESSION_VERIFY_PATH,
  BETTER_AUTH_BASE_PATH,
  resolveSessionFreshAgeSecondsFromEnv,
} from "@/constants/better-auth.js";
import {
  DEFAULT_DOCS_ACCESS_MODE,
  type DocsAccessMode,
} from "@/constants/docs-access.js";
import {
  HEALTH_OK_BODY,
  READY_CHECK_CACHE,
  READY_CHECK_POSTGREST,
  READY_STATUS_READY,
  READY_STATUS_UNAVAILABLE,
} from "@/constants/health.js";
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
import { resolveSensitiveVerifyTtlSecondsFromEnv } from "@/constants/sensitive-auth.js";
import {
  DOCS_BASE_PATH,
  HEALTH_BASE_PATH,
  READY_BASE_PATH,
  REALTIME_EVENTS_BASE_PATH,
  ROBOTS_TXT_PATH,
  UI_AUTH_BASE_PATH,
  UPLOAD_BASE_PATH,
} from "@/constants/routes.js";
import type { PostgrestClient } from "@/data/postgrest-client.js";
import type { RateLimiter } from "@/http/rate-limit.js";
import type { EventBus } from "@/realtime/event-bus.js";
import { createRealtimeEventsHandler } from "@/realtime/sse-route.js";
import { withSecurityHeadersFromRequest } from "@/http/security-headers.js";
import type { Mailer } from "@/mail/mailer-types.js";
import {
  type AuditRecorder,
  type AuditRule,
  withAudit,
} from "@/audit/audit-middleware.js";
import type { ObjectStorage } from "@/storage/storage-types.js";
import type { Logger } from "@/observability/logger.js";
import { apiDocsResponse } from "@/server/api-docs.js";
import { isDocsRouteAllowed } from "@/server/docs-route.js";
import { handleFileUpload } from "@/server/upload-route-handler.js";
import { withRateLimit } from "@/server/with-rate-limit.js";
import { buildAuthPageHtml } from "@/ui/auth-page-html.js";

const MIME_HTML_UTF8 = "text/html; charset=utf-8" as const;

const BETTER_AUTH_WILDCARD = `${BETTER_AUTH_BASE_PATH}/*` as const;

export type RouteBundle = {
  uploadDir: string;
  mailer: Mailer;
  cache: Cache;
  auth: BetterAuthInstance;
  events: EventBus;
  rateLimiter: RateLimiter;
  storage: ObjectStorage;
  idempotency?: IdempotencyGuard;
  auditRules?: AuditRule[];
  audit: AuditRecorder;
  logger: Logger;
  data?: PostgrestClient;
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

async function checkCache(cache: Cache): Promise<boolean> {
  return cache
    .ping()
    .then(() => true)
    .catch(() => false);
}

function createReadinessHandler(bundle: RouteBundle) {
  return async (req: Request): Promise<Response> => {
    const checks: Record<string, boolean> = {
      [READY_CHECK_CACHE]: await checkCache(bundle.cache),
    };
    if (bundle.data !== undefined) {
      checks[READY_CHECK_POSTGREST] = await bundle.data.health();
    }
    const ready = Object.values(checks).every(Boolean);
    const body = {
      status: ready ? READY_STATUS_READY : READY_STATUS_UNAVAILABLE,
      checks,
    };
    return withSecurityHeadersFromRequest(
      Response.json(body, { status: ready ? 200 : 503 }),
      req,
      "api",
    );
  };
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

type IdempotencyGuard = (
  req: Request,
  handler: () => Promise<Response>,
) => Promise<Response>;

function wrapIdempotent(
  handler: (req: Request) => Promise<Response> | Response,
  guard: IdempotencyGuard | undefined,
): (req: Request) => Promise<Response> {
  if (guard === undefined) {
    return async (req) => handler(req);
  }
  return (req) => guard(req, () => Promise.resolve(handler(req)));
}

function wrapAudit(
  handler: (req: Request) => Promise<Response> | Response,
  bundle: RouteBundle,
): (req: Request) => Promise<Response> {
  if (bundle.auditRules === undefined || bundle.auditRules.length === 0) {
    return async (req) => handler(req);
  }
  return withAudit(
    (req) => Promise.resolve(handler(req)),
    { record: bundle.audit, rules: bundle.auditRules, logger: bundle.logger },
  );
}

function wrapAuthHandler(
  auth: BetterAuthInstance,
  strategy: typeof RATE_LIMIT_STRATEGY_STRICT,
  limiter: RateLimiter,
) {
  return withRateLimit(strategy, async (req: Request) => {
    const oversized = rejectOversizedJson(req);
    if (oversized !== null) {
      return withSecurityHeadersFromRequest(oversized, req, "api");
    }
    const res = await auth.handler(req);
    return withSecurityHeadersFromRequest(res, req, "api");
  }, limiter);
}

function applyBotDetection(
  routes: Serve.Routes<unknown, string>,
): Serve.Routes<unknown, string> {
  const wrapped: Record<string, Record<string, unknown>> = {};
  for (const [path, route] of Object.entries(routes)) {
    const methods: Record<string, unknown> = {};
    for (const [method, handler] of Object.entries(route ?? {})) {
      methods[method] =
        typeof handler === "function"
          ? withBotDetection(handler as BotRouteHandler)
          : handler;
    }
    wrapped[path] = methods;
  }
  return wrapped as unknown as Serve.Routes<unknown, string>;
}

export function buildServeRoutes(
  bundle: RouteBundle,
  opts?: ServeRoutesOptions,
): Serve.Routes<unknown, string> {
  const { uploadDir, auth } = bundle;
  const docsAccess = opts?.docsAccess ?? DEFAULT_DOCS_ACCESS_MODE;
  const strict = RATE_LIMIT_STRATEGY_STRICT;
  const standard = RATE_LIMIT_STRATEGY_STANDARD;
  const relaxed = RATE_LIMIT_STRATEGY_RELAXED;
  const rateLimiter = bundle.rateLimiter;
  const authHandler = wrapAuthHandler(auth, strict, rateLimiter);
  const handleRealtimeEvents = createRealtimeEventsHandler({
    auth,
    bus: bundle.events,
  });
  const sensitiveStore = createSensitiveVerifyStore(
    bundle.cache,
    resolveSensitiveVerifyTtlSecondsFromEnv(),
  );
  const sensitiveDeps = {
    auth,
    store: sensitiveStore,
    freshAgeSeconds: resolveSessionFreshAgeSecondsFromEnv(),
    ttlSeconds: resolveSensitiveVerifyTtlSecondsFromEnv(),
  };
  const guardedRoutes: Serve.Routes<unknown, string> = {
    [DOCS_BASE_PATH]: {
      GET: withRateLimit(relaxed, buildDocsHandler(docsAccess), rateLimiter),
    },
    [HEALTH_BASE_PATH]: {
      GET: withRateLimit(relaxed, healthHandler, rateLimiter),
    },
    [READY_BASE_PATH]: {
      GET: withRateLimit(relaxed, createReadinessHandler(bundle), rateLimiter),
    },
    [UI_AUTH_BASE_PATH]: {
      GET: withRateLimit(relaxed, authUiHandler, rateLimiter),
    },
    [AUTH_SESSION_VERIFY_PATH]: {
      POST: withRateLimit(
        strict,
        async (req) => {
          const oversized = rejectOversizedJson(req);
          if (oversized !== null) {
            return withSecurityHeadersFromRequest(oversized, req, "api");
          }
          const res = await handleSensitiveVerify(req, sensitiveDeps);
          return withSecurityHeadersFromRequest(res, req, "api");
        },
        rateLimiter,
      ),
    },
    [AUTH_SESSION_ROTATE_PATH]: {
      POST: withRateLimit(
        strict,
        withSensitiveOperation(sensitiveDeps, async (req) => {
          const oversized = rejectOversizedJson(req);
          if (oversized !== null) {
            return withSecurityHeadersFromRequest(oversized, req, "api");
          }
          const res = await handleSessionRotate(req, auth);
          return withSecurityHeadersFromRequest(res, req, "api");
        }),
        rateLimiter,
      ),
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
      POST: withRateLimit(
        standard,
        wrapAudit(
          wrapIdempotent(
            (req) => handleFileUpload(req, { storage: bundle.storage }),
            bundle.idempotency,
          ),
          bundle,
        ),
        rateLimiter,
      ),
    },
    [REALTIME_EVENTS_BASE_PATH]: {
      GET: withRateLimit(
        relaxed,
        (req) =>
          handleRealtimeEvents(req).then((res) =>
            withSecurityHeadersFromRequest(res, req, "api"),
          ),
        rateLimiter,
      ),
    },
  };
  return {
    ...applyBotDetection(guardedRoutes),
    [ROBOTS_TXT_PATH]: {
      GET: withRateLimit(relaxed, robotsTxtResponse, rateLimiter),
    },
  };
}
