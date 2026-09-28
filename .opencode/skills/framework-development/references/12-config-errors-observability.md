# Config, errors, logging & observability

## Config validation

`loadAppConfig()` reads and validates all environment variables in one pass and
throws a single `ConfigError` listing every problem.

```ts
import { loadAppConfig } from "bun-backend-starter";

const config = loadAppConfig();
config.env.nodeEnv;       // string
config.server.port;       // number
config.database.url;      // postgres://…
config.postgrest.url;     // string | undefined
config.redis.url;         // string
config.cors.origins;      // string[]
config.log.level;         // debug | info | warn | error
config.auth.baseURL;      // string
```

`AppConfig = { env, server, database, postgrest, redis, cors, log, auth }`.

For your own grouped sections use `ConfigReader`:

```ts
import { ConfigReader } from "bun-backend-starter";

const r = new ConfigReader(process.env);
const billing = { key: r.secret("BILLING_KEY", 16), retries: r.int("BILLING_RETRIES", 3) };
r.finish();   // throws ConfigError with all issues
```

Helpers: `readEnv`, `readEnvOrThrow`, `readBoolEnv`, `readListEnv`,
`ConfigError`, `ConfigReader`.

## Logging (consola)

`createLogger()` emits one redacted JSON line per event. `app.logger` is on every
app; use `logger.child({ ... })` for scoped fields.

```ts
import { createLogger, createJsonReporter, resolveLogLevelFromEnv } from "bun-backend-starter";

const logger = createLogger({ service: "api" });
logger.info("created", { userId: "u1" });
const scoped = logger.child({ requestId: "r-1" });
scoped.warn("slow", { durationMs: 1200 });
```

- Keys like `authorization`, `cookie`, `token`, `password`, `secret` are redacted.
- `LOG_LEVEL` controls verbosity; `{ pretty: true }` uses a human reporter in dev.
- `createJsonReporter(writer)` routes JSON lines to a custom sink.
- `resolveRequestId(req)` / `HEADER_REQUEST_ID` support request correlation.

## Errors

Throw `AppError` subclasses from routes; the error middleware maps them to a
unified body and hides 5xx internals.

```ts
import { ValidationError, NotFoundError } from "bun-backend-starter";

throw new ValidationError("title is required", { field: "title" });
```

```json
{ "error": "title is required", "code": "validation_error", "requestId": "…" }
```

| Class | Status |
| --- | --- |
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `RequestTimeoutError` | 408 |
| `ConflictError` | 409 |
| `UriTooLongError` | 414 |
| `RateLimitError` | 429 |
| `ServiceUnavailableError` | 503 |
| `AppError` | base (custom status) |

`isAppError(err)`, `toErrorResponse(err, requestId)`, `errorResponse(...)` are
exported. `AppErrorOptions` supports extra fields (e.g. `{ field }`).

## Graceful shutdown & observability

See `05-cache-jobs-storage.md` for `createGracefulShutdown` / `app.close()`.
Health/readiness: `GET /health` (liveness) and `GET /ready` (checks cache +
PostgREST; `503` when not ready).
