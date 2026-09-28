# Cache, jobs, storage, mail

## Cache (`app.cache`)

`Cache = { get, set(key, value, ttlSeconds), del, ping }` (string values).
Backend chosen by `CACHE_DRIVER=redis|memory`.

```ts
import { createMemoryCache, createCacheBundle } from "corymb";

const cache = createMemoryCache({ maxItems: 10_000, defaultTtlSeconds: 300, onEviction });
await cache.set("k", "v", 60);
await cache.get("k");

const bundle = await createCacheBundle({ driver: "memory" });   // or redisUrl
```

- `redis` (default): shared across replicas. Needs `REDIS_URL`.
- `memory`: process-local LRU (`@alloc/quick-lru`); options `maxItems`
  (`MEMORY_CACHE_MAX_ITEMS`, 5000), `defaultTtlSeconds`
  (`MEMORY_CACHE_TTL_SECONDS`, 300), `onEviction`. Good for dev/tests/single-instance.
- Inject for tests: `createApp({ cache: createMemoryCache() })`.

The framework uses the cache for auth sessions/users (cache-aside), idempotency
responses, sensitive-verification state and flag caching. It also powers
Better Auth's secondary storage.

## Background jobs (`app.tasks`, BullMQ + Redis)

`app.tasks` is a durable queue: jobs survive restarts, are shared across
replicas, and get retries + exponential backoff + a dead-letter hook.

```ts
await app.tasks.run("send-email", async (payload, ctx) => {
  ctx.updateProgress(1);
  await mailer.send({ to: payload.to, subject: "Hi", text: "..." });
}, { to: "a@b.c" });

await app.tasks.queue.enqueue({ name: "warm-cache", delayMs: 5000 });
const counts = await app.tasks.queue.counts();          // { waiting, active, completed, failed, delayed }
const job = await app.tasks.queue.getJob(id);           // state snapshot
await app.tasks.queue.cancel(id);                       // cancel waiting/delayed, abort active
await app.tasks.schedule("nightly", handler, { id: "nightly", pattern: "0 3 * * *" });
```

`Tasks = { queue, run(name, handler, payload?, options?), schedule(name, handler, options) }`.
`TaskHandler<T> = (payload: T, ctx: TaskContext) => void | Promise<void>`;
`ctx = { id, name, attempt, maxAttempts, updateProgress, signal }`.
`TaskQueue` also exposes `register`, `inFlight`, `counts`, `getJob`, `cancel`,
`schedule`, `unschedule`, `schedules`, `close`.

Configure via `createApp({ taskQueue: { concurrency, concurrencyByName, maxAttempts,
backoffMs, prefix, completedRetentionSeconds, onDeadLetter } })`. Defaults:
concurrency 4, maxAttempts 3, backoff 200ms, queue name `default`.
In tests inject `taskQueueInstance: createNoopTaskQueue()`. `app.close()` drains
the queue.

## Object storage (`app.storage`)

```ts
await app.storage.put({ key: "avatars/a.png", body: bytes, contentType: "image/png" });
const bytes = await app.storage.get("avatars/a.png");       // Uint8Array | null
const meta  = await app.storage.head("avatars/a.png");      // { key, size, contentType } | null
await app.storage.delete("avatars/a.png");
const url   = app.storage.presign?.("avatars/a.png", { expiresInSeconds: 3600, method: "GET" });
```

`ObjectStorage = { driver, put, get, head, delete, presign? }`; `driver` is
`s3 | filesystem | memory`. Select with `STORAGE_DRIVER` (default filesystem
under `UPLOAD_DIR`). S3-compatible (AWS S3, R2, MinIO) uses Bun's built-in `s3`
(no AWS SDK) with `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Constructors:
`createObjectStorage`, `createS3Storage`, `createFilesystemStorage`,
`createMemoryStorage`. Inject in tests via `createApp({ storage })`.

## Mailer

```ts
type MailMessage = { to: string; subject: string; text: string };
type Mailer = { send: (message: MailMessage) => Promise<void> };
```

Default driver is `console` (`MAILER_DRIVER=console|noop`). Override with
`createApp({ mailer })`. Used by Better Auth for reset/verification/OTP emails.

## Graceful shutdown

```ts
import { createGracefulShutdown } from "corymb";

createGracefulShutdown({
  logger: app.logger,
  steps: [
    { name: "http-server", run: () => server.stop() },
    { name: "app", run: () => app.close() },   // drains tasks, closes limiter/auth/cache
  ],
}).installSignalHandlers();
```

Runs steps in order within `SHUTDOWN_TIMEOUT_MS` (default 15000) and is
idempotent. `GracefulShutdown = { shutdown, isShuttingDown, installSignalHandlers }`.
`app.close()` is safe to call repeatedly.
