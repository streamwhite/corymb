# Getting started

## Install / scaffold

```sh
# New project (recommended)
bunx corymb init my-app [--force]
cd my-app && bun install

# Use as a library in an existing project
bun add corymb

# Run the built-in server as-is
bunx corymb          # same as: bunx corymb start
```

`init` writes: `package.json`, `tsconfig.json`, `.gitignore`, `.env`,
`.env.example`, `src/index.ts` (sample routes), `postgrest/postgrest.conf`,
`README.md`. It refuses a non-empty directory unless `--force` is passed.

## CLI commands

| Command | Purpose |
| --- | --- |
| `corymb` / `start` | Start the built-in server (loads + validates config first). |
| `init <dir> [--force]` | Scaffold a consumer project. |
| `migrate` | Apply SQL migrations to `DATABASE_URL`. |
| `migrate:status` | Show applied/pending migrations. |
| `seed` | Migrate then seed demo users. |
| `jwks [out]` | Export public JWKS for PostgREST (default `postgrest/jwks.json`). |
| `--help` / `-h` | Usage. |

## Built-in HTTP routes

| Path | Method | Notes |
| --- | --- | --- |
| `/health` | GET | Liveness (`{ status: "ok" }`). |
| `/ready` | GET | Readiness: checks cache and (when configured) PostgREST; `503` when not ready. |
| `/docs` | GET | API docs page. Access mode controlled by `docsAccess` (`DocsAccessMode`). |
| `/ui` | GET | Minimal auth UI page (sign up/in/out, rotate, passkeys). |
| `/api/auth` and `/api/auth/*` | GET, POST | Better Auth handler (strict rate limit, 64 KiB JSON body cap). |
| `/api/auth/jwks` | GET | Public JWKS used by PostgREST. |
| `/api/auth/session/verify` | POST | Sensitive-operation re-verification (password). |
| `/api/auth/session/rotate` | POST | Rotate session token (requires sensitive verification). |
| `/upload` | POST | Multipart file upload into `app.storage`. |
| `/realtime/events` | GET | Authenticated SSE stream. |
| `/mcp` | POST, GET, DELETE | MCP endpoint when enabled (see `10-webhooks.md` / `11-mcp.md`). |
| `/robots.txt` | GET | Bot directives (always readable). |

Path constants are exported: `HEALTH_BASE_PATH`, `READY_BASE_PATH`, `DOCS_BASE_PATH`,
`UI_AUTH_BASE_PATH`, `UPLOAD_BASE_PATH`, `REALTIME_EVENTS_BASE_PATH`,
`ROBOTS_TXT_PATH`, `MCP_BASE_PATH`.

## Project layout (consumer and this repo)

| Area | Location |
| --- | --- |
| App wiring | `src/app.ts` (`createApp`), `src/server/start-server.ts` (`startServer`) |
| Routes + built-ins | `src/server/serve-routes.ts` |
| Middleware | `src/middleware/` (`compose`, registry, `builtin/`) |
| Auth | `src/auth/` |
| Data (PostgREST) | `src/data/` |
| DB + migrations | `src/db/` (+ `src/db/migrations/`) |
| Jobs | `src/tasks/` |
| Storage | `src/storage/` |
| Cache | `src/cache/` |
| Audit | `src/audit/` |
| Idempotency | `src/http/idempotency.ts` |
| Rate limiting | `src/http/rate-limit.ts` |
| Security | `src/security/`, `src/http/csrf.ts`, `src/http/security-headers.ts` |
| Realtime / WS | `src/realtime/`, `src/websocket/` |
| Flags / billing | `src/flags/`, `src/billing/` |
| Webhooks / MCP | `src/webhooks/`, `src/mcp/` |
| Config / logging / errors | `src/config/`, `src/observability/`, `src/errors/` |
| Scaffolding / CLI | `src/scaffold/`, `src/cli.ts` |

## Key environment variables

Required / core:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | required, >= 32 bytes | Auth secret (`JWT_SECRET` accepted as fallback). |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Public base URL for auth (emails, redirects, passkeys). |
| `DATABASE_URL` | required `postgres://…` | Admin connection: migrations, seed, Better Auth (`auth` schema). |
| `POSTGREST_URL` | unset | Enables `app.data`; application data + RLS. |
| `REDIS_URL` / `VALKEY_URL` | `redis://127.0.0.1:6379` | Cache, jobs, rate limiting, realtime fan-out. |
| `PORT` | `3000` | HTTP port. `HOST` defaults to `localhost` (dev) / `0.0.0.0` (prod). |
| `LOG_LEVEL` | `info` | `debug \| info \| warn \| error`. |
| `CORS_ORIGINS` / `CORS_CREDENTIALS` | empty / `false` | Browser CORS allowlist. |

Everything else is feature-scoped; see `.env.example` and the relevant
reference file. Useful to know:

- **Cache:** `CACHE_DRIVER=redis|memory`, `MEMORY_CACHE_MAX_ITEMS`,
  `MEMORY_CACHE_TTL_SECONDS`.
- **Storage:** `STORAGE_DRIVER=filesystem|s3|memory`, `S3_BUCKET`, `S3_REGION`,
  `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `UPLOAD_DIR`.
- **Rate limits:** `RATE_LIMIT_STRICT_MAX` (10), `RATE_LIMIT_STANDARD_MAX` (60),
  `RATE_LIMIT_RELAXED_MAX` (300), `RATE_LIMIT_KEY_PREFIX` (`rl`).
- **Request limits:** `REQUEST_TIMEOUT_MS` (30000), `MAX_URL_LENGTH` (2048).
- **Shutdown:** `SHUTDOWN_TIMEOUT_MS` (15000).
- **Idempotency:** `IDEMPOTENCY_TTL_SECONDS` (86400).
- **Bot detection:** `BOT_DETECTION_MODE` (`block`), `BOT_BLOCK_EXTRA`, `BOT_ALLOW_EXTRA`.
- **Flags:** `FEATURE_FLAGS`, `FEATURE_FLAGS_REMOTE`, `FEATURE_FLAG_CACHE_TTL_SECONDS`.
- **MCP:** `MCP_ENABLED`, `MCP_TOKEN`, `MCP_NAME`, `MCP_VERSION`.
- **Webhooks:** `WEBHOOK_TIMEOUT_MS`, `WEBHOOK_RETRIES`,
  `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`, `WEBHOOK_ALLOW_INSECURE_HTTP`.
- **Pagination:** `PAGINATION_PAGE_SIZE` (20), `PAGINATION_MAX_PAGE_SIZE` (100).
- **CSRF / brute force:** `CSRF_TTL_SECONDS`, `BRUTE_FORCE_MAX_ATTEMPTS`,
  `BRUTE_FORCE_WINDOW_SECONDS`, `BRUTE_FORCE_LOCK_SECONDS`.

## Dev workflow

```sh
bun run dev            # watch mode (scaffolded projects: `bun --watch src/index.ts`)
bun run db:migrate     # apply migrations
bun run jwks:export    # refresh postgrest/jwks.json
bun test               # unit + integration
```

Runtime startup never auto-migrates; run migrations as an explicit deploy step.
