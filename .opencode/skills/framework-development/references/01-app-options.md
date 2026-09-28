# `createApp` options and `AppInstance`

`createApp(options)` builds everything and returns an `AppInstance`.
`startServer(options)` is `createApp` plus `Bun.serve` and returns
`{ server, app, url }`. Options are `CreateAppOptions & { port?; hostname? }`.

## `CreateAppOptions`

### Core / infrastructure

| Option | Type | Default |
| --- | --- | --- |
| `routes` | `Serve.Routes` | `{}` — merged after built-ins; **your paths win**. |
| `middleware` | `Middleware[]` | `[]` — runs after built-ins, before access log. |
| `websocket` | `WebSocketEndpoint[]` | `[]` |
| `logger` | `Logger` | JSON logger at `LOG_LEVEL`. |
| `cors` | `CorsConfig` | from `CORS_ORIGINS` (disabled when empty). |
| `docsAccess` | `DocsAccessMode` | `DEFAULT_DOCS_ACCESS_MODE`. |
| `uploadDir` | `string` | `UPLOAD_DIR` or default under cwd. |
| `mailer` | `Mailer` | console mailer from `MAILER_DRIVER`. |
| `compression` | `CompressionOptions \| false` | enabled (threshold 1 KiB). |
| `requestTimeoutMs` | `number \| false` | `REQUEST_TIMEOUT_MS` (30000). |
| `maxUrlLength` | `number \| false` | `MAX_URL_LENGTH` (2048). |

### Connections

| Option | Type | Default |
| --- | --- | --- |
| `databaseConfig` | `DatabaseConfig` | `DATABASE_URL`. |
| `cache` | `Cache` | cache bundle from `REDIS_URL` / `CACHE_DRIVER`. |
| `cacheDriver` | `CacheDriver` | `CACHE_DRIVER` (`redis` \| `memory`). |
| `redisUrl` | `string` | `REDIS_URL` (also used by jobs/rate limit/events). |
| `events` | `EventBus` | Redis pub/sub with in-memory fallback. |
| `data` | `CreatePostgrestClientOptions \| false` | enabled only when `POSTGREST_URL` is set; `false` disables. |
| `rateLimiter` | `RateLimiter` | Redis (or memory) limiter. |
| `taskQueue` | `TaskQueueOptions` | concurrency 4, maxAttempts 3, backoff 200ms. |
| `taskQueueInstance` | `TaskQueue` | — inject `createNoopTaskQueue()` in tests. |

### Auth

| Option | Type | Default |
| --- | --- | --- |
| `authSecret` | `string` | `BETTER_AUTH_SECRET`. |
| `authBaseURL` | `string` | `BETTER_AUTH_URL`. |
| `authTrustedOrigins` | `string[]` | derived (localhost in dev). |
| `maxPasskeysPerUser` | `number` | `MAX_PASSKEYS_PER_USER` (5). |

### Hardening (all opt-in unless noted)

| Option | Type | Default |
| --- | --- | --- |
| `idempotencyPaths` | `string[]` | `[]` (disabled). |
| `idempotencyTtlSeconds` | `number` | `IDEMPOTENCY_TTL_SECONDS` (86400). |
| `auditSinks` | `AuditSink[]` | log sink always added. |
| `auditRules` | `AuditRule[]` | `[]`. |
| `csrf` | `CsrfOptions \| false` | disabled (pass `{}` to enable globally). |
| `bruteForce` | `BruteForceOptions \| false` | disabled (pass `{}` to enable globally). |
| `flags` | `FeatureFlags` | env flags; cache-backed when `FEATURE_FLAGS_REMOTE`. |
| `billing` | `Billing \| BillingProvider \| false` | in-memory provider (empty). |
| `mcp` | `McpOptions \| false` | from `MCP_ENABLED`/`MCP_TOKEN` (off by default). |
| `webhooks` | `WebhookDispatcher \| WebhookDispatcherOptions \| false` | disabled. |
| `storage` | `ObjectStorage` | from `STORAGE_DRIVER` (default filesystem). |
| `storageOptions` | `Omit<CreateStorageOptions, "driver">` | — |

Middleware order built by `createApp`: request-id → error handler →
max-URL-length → request-timeout → compression → CSRF → brute-force →
**your `middleware`** → access log. CORS wraps the chain.

## `AppInstance`

| Member | Type | Notes |
| --- | --- | --- |
| `routes` | `Serve.Routes` | Pass to `Bun.serve({ routes })`. |
| `fetchNotFound` | `(req) => Response` | 404 fallback (bot-aware). |
| `onServeError` | `(err) => Response` | 500 handler; hides internals. |
| `cache` | `Cache` | `get`/`set`/`del`/`ping`. |
| `auth` | `BetterAuthInstance` | Better Auth instance. |
| `events` | `EventBus` | `publish`/`subscribe` for realtime. |
| `logger` | `Logger` | structured JSON logger (+ `child`). |
| `audit` | `(input) => Promise<void>` | fan-out audit recorder. |
| `tasks` | `Tasks` | BullMQ facade (`run`, `schedule`, `queue`). |
| `storage` | `ObjectStorage` | `put`/`get`/`head`/`delete`/`presign?`. |
| `flags` | `FeatureFlags` | `isEnabled`, `all`. |
| `billing?` | `Billing` | present unless `billing: false`. |
| `webhooks?` | `WebhookDispatcher` | present when configured. |
| `websocket?` | `WebSocketServer` | present when endpoints exist. |
| `websocketRoutes` | `Serve.Routes` | Raw upgrade routes (need Bun's `server` arg). |
| `createContext` | `(req) => MiddlewareContext` | build a ctx for direct handler calls. |
| `data?` | `PostgrestClient` | present when PostgREST is configured. |
| `close` | `() => Promise<void>` | drains tasks, closes limiter/auth/cache; idempotent. |

## Owning `Bun.serve` yourself

```ts
import { createApp } from "bun-backend-starter";

const app = await createApp({ /* options */ });
Bun.serve({
  routes: { ...app.routes, ...app.websocketRoutes },
  fetch: app.fetchNotFound,
  error: app.onServeError,
  port: 3000,
  websocket: app.websocket?.handler,
});
```
