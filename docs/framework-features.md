# Configuration, logging, errors, audit and tasks

This framework ships opinionated, production-oriented primitives so new projects
start with consistent behavior.

## Configuration management

`loadAppConfig()` reads and validates every environment variable in one pass and
throws a single `ConfigError` listing all problems.

```ts
import { loadAppConfig } from "bun-backend-starter";

const config = loadAppConfig();
config.server.port;      // number
config.database.url;     // postgres://...
config.postgrest.url;    // string | undefined
config.cors.origins;     // string[]
config.log.level;        // debug | info | warn | error
```

Use `ConfigReader` for your own grouped, validated sections:

```ts
import { ConfigReader } from "bun-backend-starter";

const r = new ConfigReader(process.env);
const billing = { key: r.secret("BILLING_KEY", 16), retries: r.int("BILLING_RETRIES", 3) };
r.finish(); // throws ConfigError with all issues
```

## Logging (consola)

`createLogger()` wraps [consola](https://github.com/unjs/consola) and emits one
redacted JSON line per event by default. `app.logger` is available on every app.

```ts
const logger = createLogger({ service: "api" });
logger.info("created", { userId: "u1" });            // JSON line
const scoped = logger.child({ requestId: "r-1" });
scoped.warn("slow", { durationMs: 1200 });
```

- Keys like `authorization`, `cookie`, `token`, `password`, `secret` are redacted.
- `LOG_LEVEL` controls verbosity.
- Pass `{ pretty: true }` for consola's human-readable reporter in local dev.
- `createJsonReporter(writer)` lets you route JSON lines to a custom sink.

## Error handling

Throw `AppError` subclasses from routes; middleware maps them to a unified body
and hides 5xx internals.

```ts
import { ValidationError, NotFoundError } from "bun-backend-starter";

throw new ValidationError("title is required", { field: "title" });
```

```json
{ "error": "title is required", "code": "validation_error", "requestId": "..." }
```

Available: `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError`
(403), `NotFoundError` (404), `ConflictError` (409), `RateLimitError` (429),
`ServiceUnavailableError` (503), plus base `AppError`. Use `toErrorResponse(err,
requestId)` to render one manually.

## Audit events

`app.audit({ action, ... })` fans out to the structured-log sink and any
`auditSinks` you configure. Sink errors are logged, never thrown.

```ts
await app.audit({
  action: AUDIT_ACTIONS.dataDeleted,
  outcome: "success",
  actor: { id: userId, ip, userAgent },
  target: { type: "todo", id },
});
```

Durable options: `createFileAuditSink("data/audit.jsonl")` or a PostgREST-backed
sink via `app.data`. `createMemoryAuditSink()` is handy in tests.

## Background tasks (BullMQ + Redis)

`app.tasks` is a durable Redis-backed job queue built on
[BullMQ](https://docs.bullmq.io). Jobs survive restarts and are shared across
replicas; retries, exponential backoff and a dead-letter hook are built in.

```ts
await app.tasks.run("send-email", async ({ to }) => {
  await mailer.send({ to, subject: "Hi", text: "..." });
}, { to: "a@b.c" });

await app.tasks.queue.enqueue({ name: "warm-cache", delayMs: 5000 });
const counts = await app.tasks.queue.counts();
```

Configure via `createApp({ taskQueue: { concurrency: 8, maxAttempts: 5,
onDeadLetter } })`. Connection comes from `REDIS_URL`. In tests, inject
`taskQueueInstance: createNoopTaskQueue()` to run without Redis.

## Object storage

`app.storage` abstracts filesystem/S3/memory behind one interface and backs the
built-in `POST /upload` route.

```ts
await app.storage.put({ key: "avatars/a.png", body: bytes, contentType: "image/png" });
const url = app.storage.presign?.("avatars/a.png", { expiresInSeconds: 3600 });
```

- Default driver: filesystem under `UPLOAD_DIR`. Set `STORAGE_DRIVER=s3` (with
  `S3_BUCKET`/`S3_REGION`/`S3_ENDPOINT`) for AWS S3, Cloudflare R2 or MinIO; the
  adapter uses Bun's built-in `s3` client (no AWS SDK).
- `createMemoryStorage()` / `createFilesystemStorage(root)` are useful in tests.

## Idempotency keys

Protect retry-prone mutations by listing path prefixes and requiring the
`Idempotency-Key` header. Identical retries replay the stored response; reuse
with a different body or a concurrent duplicate gets `409`.

```ts
const app = await createApp({ idempotencyPaths: ["/api/payments"] });
```

Responses are cached in Redis via the cache layer (`IDEMPOTENCY_TTL_SECONDS`,
default 24h). Replays carry `Idempotent-Replay: true`.

## Audit middleware

Record audit events automatically for selected paths, in addition to explicit
`app.audit(...)` calls.

```ts
const app = await createApp({
  auditRules: [{ path: "/api/payments", action: "payment.created", targetType: "payment" }],
});
```

Outcome is inferred from the status code; the actor IP/user-agent come from the
request. Events fan out to the log sink and any `auditSinks`
(e.g. `createFileAuditSink`, or `createQueueAuditSink` to persist via BullMQ).

## Graceful shutdown

`createGracefulShutdown` runs teardown steps in order within a deadline and is
idempotent.

```ts
createGracefulShutdown({
  logger: app.logger,
  steps: [
    { name: "http-server", run: () => server.stop() },
    { name: "app", run: () => app.close() }, // drains BullMQ, closes pools/cache
  ],
}).installSignalHandlers();
```

`app.close()` stops accepting work, waits for in-flight jobs, then closes
events/auth/cache. Tune `SHUTDOWN_TIMEOUT_MS` (default 15s).

## Rate limiting

Tiered fixed-window limits are enforced with
[`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible).
With `REDIS_URL` set, counters are atomic and shared across every replica;
otherwise an in-memory limiter covers single-instance deploys.

```ts
import { withRateLimit, createRateLimiter } from "bun-backend-starter";

// Use the shared default limiter (Redis via REDIS_URL):
"/api/x": { POST: withRateLimit("strict", handler) };

// Or bind an explicit limiter:
const limiter = createRateLimiter({ redisUrl: process.env.REDIS_URL });
"/api/y": { GET: withRateLimit("relaxed", handler, limiter) };
```

- Strategies: `strict` (10/min), `standard` (60/min), `relaxed` (300/min),
  overridable with `RATE_LIMIT_STRICT_MAX` / `RATE_LIMIT_STANDARD_MAX` /
  `RATE_LIMIT_RELAXED_MAX`.
- Client key comes from `X-Forwarded-For` (first hop) then `X-Real-IP`.
- Rejections return `429` with a `Retry-After` header.
- `RATE_LIMIT_KEY_PREFIX` namespaces Redis keys for shared Redis instances.
- In tests, inject `createRateLimiter()` (memory) via `createApp({ rateLimiter })`
  to avoid needing Redis.

## Middleware

Compose reusable middleware around any route. A middleware receives a shared
`MiddlewareContext` and a `next` function; it may short-circuit by returning a
response.

```ts
import { compose, type Middleware } from "bun-backend-starter";

const withTenant: Middleware = (ctx, next) => {
  ctx.state.tenant = ctx.req.headers.get("X-Tenant-Id") ?? "public";
  return next();
};

const handler = compose([withTenant], async (ctx) => {
  return Response.json({ tenant: ctx.state.tenant });
});
```

Register global middleware via `createApp({ middleware: [...] })`. It runs after
the built-ins (request-id, error handling, compression) and before access logs.
Named middleware can be assembled with `createMiddlewareRegistry()`.

The context exposes `req`, `url`, `requestId`, `logger`, `cache`, `auth`,
`storage`, optional `data`, and a mutable `state` bag.

## Request validation

Schema-agnostic validators parse/normalize input or throw `ValidationError`;
`withValidation` attaches the result to `ctx.state`.

```ts
import { withValidation, readValidated, ValidationError } from "bun-backend-starter";

const parseTodo = (input: unknown) => {
  const { title } = input as { title?: unknown };
  if (typeof title !== "string" || !title.trim()) {
    throw new ValidationError("title is required", { field: "title" });
  }
  return { title: title.trim() };
};

const handler = compose([withValidation(parseTodo)], async (ctx) => {
  const input = readValidated<{ title: string }>(ctx);
  return Response.json(input);
});
```

Use `{ target: "query" }` to validate query parameters.

## Compression

`withCompression` is enabled by default. It negotiates `Accept-Encoding` and
compresses text-like responses (JSON, HTML, SVG, XML, JS) with brotli, gzip,
deflate or zstd above `COMPRESSION_DEFAULT_THRESHOLD` (1 KiB). Streaming
responses (`text/event-stream`) and binary content are skipped.

```ts
const app = await createApp({ compression: { thresholdBytes: 2048 } });
// or disable: createApp({ compression: false })
```

## Cookies

```ts
import {
  parseCookies, serializeCookie, signCookieValue, verifyCookieValue, withCookies,
} from "bun-backend-starter";

const signed = signCookieValue("session-1", secret);
const value = verifyCookieValue(signed, secret);          // undefined if tampered
const header = serializeCookie("sid", signed, { httpOnly: true, secure: true });

// Middleware parses Cookie into ctx.state.cookies
compose([withCookies()], async (ctx) =>
  Response.json(ctx.state.cookies ?? {}),
);
```

## Multipart / file upload

`parseMultipartUpload` parses a multipart request into a file + text fields and
enforces a size cap (throws `ValidationError`).

```ts
import { parseMultipartUpload, isMultipart } from "bun-backend-starter";

const { file, fields } = await parseMultipartUpload(req, { maxBytes: 5_000_000 });
await app.storage.put({ key: file.filename, body: file.bytes, contentType: file.contentType });
```

## Streaming

```ts
import { createSseResponse, streamFromIterable, formatSseEvent } from "bun-backend-starter";

// SSE with imperative send/close
return createSseResponse((stream) => {
  stream.send({ event: "tick", data: "1" });
  stream.close();
});

// Stream any async iterable
return streamFromIterable(asyncGenerator());
```

## WebSocket

Register endpoints on `startServer`/`createApp`; each is matched by exact path
and upgraded after an optional `authorize` check.

```ts
await startServer({
  websocket: [
    {
      path: "/ws/echo",
      authorize: (req) => Boolean(req.headers.get("Authorization")),
      open(ws) { ws.subscribe("room"); },
      message(ws, msg) { ws.publish("room", msg); },
      close(ws) { ws.unsubscribe("room"); },
    },
  ],
});
```

`ws.data` carries `{ connectionId, path, auth? }`.

## Session management

`withSession` requires an authenticated session (cookie or bearer), attaching
`ctx.state.session`/`ctx.state.user`; `getOptionalSession` reads it without
requiring one.

```ts
import { withSession, readUser } from "bun-backend-starter";

const handler = compose([withSession()], async (ctx) => {
  return Response.json({ user: readUser(ctx) });
});
```

## Caching

The framework caches auth sessions/users (cache-aside). Pick the backend with
`CACHE_DRIVER`:

- `redis` (default) — shared across replicas; use for production.
- `memory` — process-local LRU via
  [`@alloc/quick-lru`](https://github.com/alloc/quick-lru); no Redis needed,
  good for local dev, tests, and single-instance deploys.

```sh
CACHE_DRIVER=memory bun run dev
```

Programmatic use:

```ts
import { createMemoryCache, createCacheBundle } from "bun-backend-starter";

const cache = createMemoryCache({ maxItems: 10_000, defaultTtlSeconds: 300 });
await cache.set("k", "v", 60);
await cache.get("k");

// Or select a driver:
const bundle = await createCacheBundle({ driver: "memory" });
```

Memory cache behavior:

- LRU eviction once `maxItems` is exceeded (`MEMORY_CACHE_MAX_ITEMS`, default
  5000); `onEviction` fires for capacity/TTL evictions.
- Per-entry TTLs; entries expire lazily on read/write.
- Also usable directly via `createApp({ cache: createMemoryCache() })`.

## Suggested next modules

Not included to keep the core lean; add per project as needed: OpenTelemetry
metrics/traces, feature flags, outbox/transactional messaging.
