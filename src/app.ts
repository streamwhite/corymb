import type { Serve } from "bun";
import { readEnv } from "@/config/env.js";
import { createAuthRuntime } from "@/auth/auth-runtime.js";
import { createAuditLogger } from "@/audit/audit-logger.js";
import type { AuditSink } from "@/audit/audit-types.js";
import type { CorsConfig } from "@/constants/cors.js";
import { resolveRateLimitKeyPrefixFromEnv } from "@/constants/rate-limit.js";
import { resolveCorsFromEnv } from "@/http/cors.js";
import { createRateLimiter, type RateLimiter } from "@/http/rate-limit.js";
import { applyRouteMiddleware, wrapFallbackHandler } from "@/server/apply-middleware.js";
import type {
  Middleware,
  MiddlewareContext,
} from "@/middleware/middleware-types.js";
import {
  withAccessLog,
  withErrorHandler,
  withRequestId,
} from "@/middleware/builtin/observability.js";
import {
  withCompression,
  type CompressionOptions,
} from "@/middleware/builtin/compression.js";
import {
  withMaxUrlLength,
  withRequestTimeout,
} from "@/middleware/builtin/limits.js";
import { withCsrf, type CsrfOptions } from "@/http/csrf.js";
import {
  createBruteForceGuard,
  withBruteForce,
  type BruteForceOptions,
} from "@/security/brute-force.js";
import {
  resolveMaxUrlLengthFromEnv,
  resolveRequestTimeoutMsFromEnv,
} from "@/constants/security.js";
import {
  createEnvFeatureFlags,
  createCachedFeatureFlags,
  type FeatureFlags,
} from "@/flags/feature-flags.js";
import {
  resolveFeatureFlagCacheTtlFromEnv,
  resolveFeatureFlagsRemoteFromEnv,
} from "@/constants/flags.js";
import {
  createBilling,
  createMemoryBillingProvider,
} from "@/billing/billing.js";
import type { Billing, BillingProvider } from "@/billing/billing-types.js";
import {
  buildMcpRoutes,
  createMcpHandler,
  type McpOptions,
} from "@/mcp/mcp-server.js";
import {
  createWebhookDispatcher,
  type WebhookDispatcherOptions,
} from "@/webhooks/webhook-dispatcher.js";
import type { WebhookDispatcher } from "@/webhooks/webhook-types.js";
import {
  DEFAULT_MCP_VERSION,
  ENV_MCP_ENABLED,
  ENV_MCP_TOKEN,
  MCP_BASE_PATH,
  resolveMcpConfigFromEnv,
} from "@/constants/mcp.js";
import {
  createWebSocketServer,
  createWebSocketUpgrade,
  type UpgradeCapableServer,
  type WebSocketEndpoint,
  type WebSocketServer,
} from "@/websocket/websocket.js";
import { createLogger, type Logger } from "@/observability/logger.js";
import { resolveServiceNameFromEnv } from "@/constants/server.js";
import { createTasks, createTasksFromQueue } from "@/tasks/tasks.js";
import type { TaskQueueOptions } from "@/tasks/task-types.js";
import {
  createObjectStorage,
  type CreateStorageOptions,
} from "@/storage/storage.js";
import type { ObjectStorage } from "@/storage/storage-types.js";
import {
  createIdempotencyGuard,
} from "@/http/idempotency.js";
import type { AuditRule } from "@/audit/audit-middleware.js";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import { blockRequestIfBot } from "@/bot/bot-guard.js";
import type { Cache } from "@/cache/cache-types.js";
import { closeCacheBundle, createCacheBundle } from "@/cache/client.js";
import type { CacheDriver } from "@/constants/cache-driver.js";
import {
  DEFAULT_DOCS_ACCESS_MODE,
  type DocsAccessMode,
} from "@/constants/docs-access.js";
import {
  HTTP_STATUS_INTERNAL,
  HTTP_STATUS_NOT_FOUND,
} from "@/constants/http-status.js";
import { MSG_HTTP_NOT_FOUND, MSG_INTERNAL } from "@/constants/messages.js";
import { ENV_POSTGREST_URL } from "@/constants/postgrest.js";
import { resolveRedisUrlFromEnv } from "@/constants/redis.js";
import {
  createPostgrestClient,
  type CreatePostgrestClientOptions,
  type PostgrestClient,
} from "@/data/postgrest-client.js";
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
import type { DatabaseConfig } from "@/constants/database.js";

export type CreateAppOptions = {
  /** Override the auth database (tests); defaults to `DATABASE_URL`. */
  databaseConfig?: DatabaseConfig;
  docsAccess?: DocsAccessMode;
  /** Override upload root (absolute or cwd-relative); else `UPLOAD_DIR` env; else default under cwd. */
  uploadDir?: string;
  /** Optional mailer (defaults to console mailer via env). */
  mailer?: Mailer;
  /** Cache override (defaults to Redis via `REDIS_URL`). Use `createMemoryCache()` for local/tests. */
  cache?: Cache;
  /** Cache backend when `cache` is not provided; defaults to `CACHE_DRIVER` env. */
  cacheDriver?: CacheDriver;
  /** Override Redis URL when creating the default cache bundle. */
  redisUrl?: string;
  /** Override Better Auth secret (tests). */
  authSecret?: string;
  /** Override Better Auth base URL (tests). */
  authBaseURL?: string;
  /** Override Better Auth trusted origins (tests). */
  authTrustedOrigins?: string[];
  /** Override maximum passkeys per user (tests). */
  maxPasskeysPerUser?: number;
  /** Override event bus (tests); defaults to Redis pub/sub with memory fallback. */
  events?: EventBus;
  /**
   * PostgREST data client options. Defaults to `POSTGREST_URL` when set;
   * pass `fetch` to inject a transport in tests. Pass `false` to disable the
   * data client entirely (e.g. tests that assert behavior without PostgREST).
   */
  data?: CreatePostgrestClientOptions | false;
  /** CORS allowlist; defaults to `CORS_ORIGINS` env (disabled when empty). */
  cors?: CorsConfig;
  /** Structured logger; defaults to JSON logs at `LOG_LEVEL`. */
  logger?: Logger;
  /** Extra audit sinks (durable stores, SIEM); the log sink is always added. */
  auditSinks?: AuditSink[];
  /** Background task queue tuning (concurrency, retries, dead-letter). */
  taskQueue?: TaskQueueOptions;
  /** Task queue override (tests); bypasses BullMQ/Redis when provided. */
  taskQueueInstance?: import("@/tasks/task-types.js").TaskQueue;
  /** Rate limiter override (tests); defaults to Redis via `REDIS_URL`. */
  rateLimiter?: RateLimiter;
  /** Object storage override (tests); defaults from `STORAGE_DRIVER` env. */
  storage?: ObjectStorage;
  /** Additional storage driver options (S3 bucket/region, filesystem root). */
  storageOptions?: Omit<CreateStorageOptions, "driver">;
  /**
   * Path prefixes that require an `Idempotency-Key` on mutating requests.
   * Empty/omitted disables idempotency enforcement.
   */
  idempotencyPaths?: string[];
  /** How long idempotent responses stay replayable (seconds). */
  idempotencyTtlSeconds?: number;
  /** Path rules for automatic audit events on requests. */
  auditRules?: AuditRule[];
  /** Extra middleware applied to every route (runs after CORS). */
  middleware?: Middleware[];
  /** Compression middleware config; `false` disables it. */
  compression?: CompressionOptions | false;
  /** Request timeout middleware (ms); `false` disables it. Defaults to env. */
  requestTimeoutMs?: number | false;
  /** Max request URL length (chars); `false` disables it. Defaults to env. */
  maxUrlLength?: number | false;
  /** CSRF double-submit protection; enabled when provided. */
  csrf?: CsrfOptions | false;
  /** Brute-force lockout for credential routes; enabled when provided. */
  bruteForce?: BruteForceOptions | false;
  /** Feature flag provider; defaults to env flags (cache-backed when remote). */
  flags?: FeatureFlags;
  /** Billing provider/facade; `false` disables it. Defaults to in-memory. */
  billing?: Billing | BillingProvider | false;
  /** MCP endpoint; enabled when provided or when `MCP_ENABLED` is set. */
  mcp?: McpOptions | false;
  /** Outbound webhook dispatcher; enabled when provided. */
  webhooks?: WebhookDispatcher | WebhookDispatcherOptions | false;
  /** WebSocket endpoints exposed by the server. */
  websocket?: WebSocketEndpoint[];
  /** Extra `Bun.serve` routes merged after built-ins (consumer paths win on conflict). */
  routes?: Serve.Routes<unknown, string>;
};

export type AppInstance = {
  routes: Serve.Routes<unknown, string>;
  fetchNotFound: (req: Request) => Response | Promise<Response>;
  onServeError: (err: unknown) => Response | Promise<Response>;
  cache: Cache;
  auth: BetterAuthInstance;
  events: EventBus;
  logger: Logger;
  /** Structured audit logger (log sink + any configured sinks). */
  audit: (input: import("@/audit/audit-logger.js").RecordAuditInput) => Promise<void>;
  /** Background job queue (BullMQ) for durable async work. */
  tasks: import("@/tasks/task-types.js").TaskQueue;
  /** Object storage (S3 / filesystem / memory). */
  storage: ObjectStorage;
  /** Feature flag provider (env-backed by default). */
  flags: FeatureFlags;
  /** Billing facade, when enabled. */
  billing?: Billing;
  /** Outbound webhook dispatcher, when enabled. */
  webhooks?: WebhookDispatcher;
  /** WebSocket server (handler + endpoint lookup), when endpoints exist. */
  websocket?: WebSocketServer;
  /** Raw upgrade routes (need `Bun.serve`'s `server` arg; not middleware-wrapped). */
  websocketRoutes: Serve.Routes<unknown, string>;
  /** Builds the per-request middleware context (used for direct handler calls). */
  createContext: (req: Request) => MiddlewareContext;
  /** Present when `POSTGREST_URL` (or `data`) is configured. */
  data?: PostgrestClient;
  /** Stops accepting work and releases resources; idempotent. */
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

function limitMiddleware(
  maxUrlLength: number | null,
  requestTimeoutMs: number | null,
): Middleware[] {
  return [
    ...(maxUrlLength === null ? [] : [withMaxUrlLength(maxUrlLength)]),
    ...(requestTimeoutMs === null ? [] : [withRequestTimeout(requestTimeoutMs)]),
  ];
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
  const [cacheBundle, eventsBundle] = await Promise.all([
    options?.cache !== undefined
      ? Promise.resolve({ cache: options.cache, close: () => {} })
      : createCacheBundle({
          redisUrl: options?.redisUrl,
          driver: options?.cacheDriver,
        }),
    options?.events !== undefined
      ? Promise.resolve({ bus: options.events, owned: false })
      : createDefaultEventBus({
          url: options?.redisUrl ?? resolveRedisUrlFromEnv(),
        }).then(({ bus }) => ({ bus, owned: true })),
  ]);
  const mailer = options?.mailer ?? resolveMailerFromEnv();
  const authRuntime = createAuthRuntime({
    cache: cacheBundle.cache,
    mailer,
    databaseConfig: options?.databaseConfig,
    secret: options?.authSecret,
    baseURL: options?.authBaseURL,
    trustedOrigins: options?.authTrustedOrigins,
    maxPasskeysPerUser: options?.maxPasskeysPerUser,
  });
  const docsAccess = options?.docsAccess ?? DEFAULT_DOCS_ACCESS_MODE;
  const uploadDir = resolveUploadRoot({ uploadDir: options?.uploadDir });
  const data = resolveDataClient(options);
  const logger =
    options?.logger ?? createLogger({ service: resolveServiceNameFromEnv() });
  const auditLogger = createAuditLogger({
    logger,
    sinks: options?.auditSinks,
  });
  const { queue: tasks } =
    options?.taskQueueInstance !== undefined
      ? createTasksFromQueue(options.taskQueueInstance)
      : createTasks(
          {
            redisUrl: options?.redisUrl ?? resolveRedisUrlFromEnv(),
            ...options?.taskQueue,
          },
          logger,
        );
  const rateLimiter =
    options?.rateLimiter ??
    createRateLimiter({
      redisUrl: options?.redisUrl ?? resolveRedisUrlFromEnv(),
      keyPrefix: resolveRateLimitKeyPrefixFromEnv(),
    });
  const storage =
    options?.storage ??
    createObjectStorage({ rootDir: uploadDir, ...options?.storageOptions });
  const bruteForceOption = options?.bruteForce;
  const bruteForceConfig =
    bruteForceOption === false ? undefined : bruteForceOption;
  const bruteForceGuard =
    bruteForceConfig === undefined
      ? undefined
      : createBruteForceGuard({
          redisUrl: options?.redisUrl ?? resolveRedisUrlFromEnv(),
          ...bruteForceConfig,
        });
  const idempotency = buildIdempotencyGuard(options, cacheBundle.cache, logger);
  const flags =
    options?.flags ??
    (resolveFeatureFlagsRemoteFromEnv()
      ? createCachedFeatureFlags({
          cache: cacheBundle.cache,
          source: createEnvFeatureFlags(),
          ttlSeconds: resolveFeatureFlagCacheTtlFromEnv(),
        })
      : createEnvFeatureFlags());
  const billing = resolveBilling(options?.billing);
  const webhooks = resolveWebhooks(options?.webhooks);
  const mcpConfig = resolveMcpOptions(options);
  const mcpRoutes: Serve.Routes<unknown, string> =
    mcpConfig === undefined
      ? {}
      : (buildMcpRoutes(
          MCP_BASE_PATH,
          createMcpHandler(
            {
              name: resolveServiceNameFromEnv(),
              version: DEFAULT_MCP_VERSION,
              environment: process.env.NODE_ENV ?? "production",
              logger,
              health: () => buildHealthChecks(cacheBundle.cache, data),
              flags,
              taskCounts: () => tasks.counts(),
            },
            mcpConfig,
          ),
        ) as unknown as Serve.Routes<unknown, string>);
  const builtInRoutes = buildServeRoutes(
    {
      uploadDir,
      mailer,
      cache: cacheBundle.cache,
      auth: authRuntime.auth,
      events: eventsBundle.bus,
      rateLimiter,
      storage,
      idempotency,
      auditRules: options?.auditRules,
      audit: auditLogger.record,
      logger,
      data,
    },
    { docsAccess },
  );
  const createContext = makeContextFactory({
    logger,
    cache: cacheBundle.cache,
    auth: authRuntime.auth,
    storage,
    data,
  });
  const compression =
    options?.compression === false
      ? []
      : [withCompression(options?.compression ?? {})];
  const timeoutOption = options?.requestTimeoutMs;
  const requestTimeoutMs =
    timeoutOption === false
      ? null
      : (timeoutOption ?? resolveRequestTimeoutMsFromEnv());
  const urlLengthOption = options?.maxUrlLength;
  const maxUrlLength =
    urlLengthOption === false
      ? null
      : (urlLengthOption ?? resolveMaxUrlLengthFromEnv());
  const csrfOption = options?.csrf;
  const csrfConfig = csrfOption === false ? undefined : csrfOption;
  const middleware = {
    cors: options?.cors ?? resolveCorsFromEnv(),
    logger,
    middleware: [
      withRequestId(),
      withErrorHandler(),
      ...limitMiddleware(maxUrlLength, requestTimeoutMs),
      ...compression,
      ...(csrfConfig === undefined ? [] : [withCsrf(csrfConfig)]),
      ...(bruteForceGuard === undefined || bruteForceConfig === undefined
        ? []
        : [withBruteForce(bruteForceGuard, bruteForceConfig)]),
      ...(options?.middleware ?? []),
      withAccessLog(),
    ],
  };
  const routes = applyRouteMiddleware(
    { ...builtInRoutes, ...mcpRoutes, ...(options?.routes ?? {}) },
    middleware,
    createContext,
  );
  const websocket =
    options?.websocket !== undefined && options.websocket.length > 0
      ? createWebSocketServer(options.websocket)
      : undefined;
  const websocketRoutes =
    websocket === undefined ? {} : buildUpgradeRoutes(websocket);
  let closed = false;
  return {
    routes,
    fetchNotFound: wrapFallbackHandler(fetchNotFound, middleware, createContext),
    onServeError,
    cache: cacheBundle.cache,
    auth: authRuntime.auth,
    events: eventsBundle.bus,
    logger,
    audit: auditLogger.record,
    tasks,
    storage,
    flags,
    ...(billing === undefined ? {} : { billing }),
    ...(webhooks === undefined ? {} : { webhooks }),
    websocket,
    websocketRoutes,
    createContext,
    data,
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await tasks.close();
      rateLimiter.close();
      bruteForceGuard?.close();
      if (eventsBundle.owned) {
        await eventsBundle.bus.close().catch((err: unknown) =>
          logger.error("events close failed", {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      await authRuntime.close();
      closeCacheBundle(cacheBundle);
    },
  };
}

function buildUpgradeRoutes(
  websocket: WebSocketServer,
): Serve.Routes<unknown, string> {
  const routes: Record<string, Record<string, unknown>> = {};
  for (const path of websocket.paths) {
    const upgrade = createWebSocketUpgrade(path, websocket);
    routes[path] = {
      GET: (req: Request, server: UpgradeCapableServer) =>
        upgrade(req, server).then((res) => res ?? new Response(null)),
    };
  }
  return routes as unknown as Serve.Routes<unknown, string>;
}

function makeContextFactory(deps: {
  logger: Logger;
  cache: Cache;
  auth: BetterAuthInstance;
  storage: ObjectStorage;
  data?: PostgrestClient;
}): (req: Request) => MiddlewareContext {
  return (req) => ({
    req,
    url: new URL(req.url),
    requestId: "",
    logger: deps.logger,
    cache: deps.cache,
    auth: deps.auth,
    storage: deps.storage,
    data: deps.data,
    state: {},
  });
}

function buildIdempotencyGuard(
  options: CreateAppOptions | undefined,
  cache: Cache,
  logger: Logger,
): ((req: Request, handler: () => Promise<Response>) => Promise<Response>) | undefined {
  const paths = options?.idempotencyPaths ?? [];
  if (paths.length === 0) {
    return undefined;
  }
  return createIdempotencyGuard({
    cache,
    logger,
    protectedPaths: paths,
    ttlSeconds: options?.idempotencyTtlSeconds,
  });
}

function resolveBilling(
  option: Billing | BillingProvider | false | undefined,
): Billing | undefined {
  if (option === false) {
    return undefined;
  }
  if (option === undefined) {
    return createBilling(createMemoryBillingProvider());
  }
  return "hasFeature" in option ? option : createBilling(option);
}

async function buildHealthChecks(
  cache: Cache,
  data?: PostgrestClient,
): Promise<Record<string, boolean>> {
  const checks: Record<string, boolean> = {
    cache: await cache
      .ping()
      .then(() => true)
      .catch(() => false),
  };
  if (data !== undefined) {
    checks.postgrest = await data.health();
  }
  return checks;
}

function resolveWebhooks(
  option: WebhookDispatcher | WebhookDispatcherOptions | false | undefined,
): WebhookDispatcher | undefined {
  if (option === false || option === undefined) {
    return undefined;
  }
  return "dispatch" in option ? option : createWebhookDispatcher(option);
}

function resolveMcpOptions(
  options?: CreateAppOptions,
): McpOptions | undefined {
  if (options?.mcp === false) {
    return undefined;
  }
  if (options?.mcp !== undefined) {
    return options.mcp;
  }
  const config = resolveMcpConfigFromEnv();
  if (!config.enabled) {
    return undefined;
  }
  if (config.token === undefined) {
    throw new Error(`${ENV_MCP_ENABLED} requires ${ENV_MCP_TOKEN} to be set`);
  }
  return { token: config.token, name: config.name, version: config.version };
}

function shouldCreateDataClient(options?: CreateAppOptions): boolean {
  if (options?.data === false) {
    return false;
  }
  if (options?.data !== undefined) {
    return true;
  }
  return readEnv(ENV_POSTGREST_URL) !== undefined;
}

function resolveDataClient(
  options?: CreateAppOptions,
): PostgrestClient | undefined {
  if (!shouldCreateDataClient(options)) {
    return undefined;
  }
  return createPostgrestClient(options?.data === false ? undefined : options?.data);
}
