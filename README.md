# bun-backend-starter

Production-ready Bun backend as an installable package: authentication, persistence, caching, realtime, rate limiting, uploads and API docs — everything wired and tested.

## Features

- **Auth** — Better Auth (email/password, username, session rotation, bearer + JWT, passkeys/WebAuthn, 2FA email OTP/TOTP + backup codes)
- **Data** — PostgreSQL + PostgREST (`app` schema) with JWT/RLS; auth in a dedicated `auth` schema via `DATABASE_URL`
- **Database** — SQL migrations (apply/status CLI), transactions, and a Unit of Work for atomic multi-step operations
- **Hardening** — request ids, structured JSON logs (consola), unified error handling, CORS allowlist, liveness/readiness probes
- **Framework** — validated typed config, graceful shutdown, project scaffolding
- **Jobs** — durable background queue (BullMQ + Redis) with retries/backoff and dead-letter
- **Storage** — object storage adapter (S3-compatible via Bun's `s3`, filesystem, memory) powering `/upload`
- **Audit** — structured audit events, path rules for automatic auditing, pluggable sinks
- **Idempotency** — `Idempotency-Key` protection for selected mutating paths
- **Realtime** — authenticated SSE events (Redis pub/sub fan-out, in-memory fallback)
- **Caching** — Redis cache-aside for auth sessions/users (`createMemoryCache()` for local/tests)
- **Rate limiting** — tiered limits via `rate-limiter-flexible` (atomic + shared over Redis), bot detection (`isbot`)
- **Middleware** — composable middleware with a shared request context, registry, and built-in request-id/error/compression/logging
- **Platform** — request validation, compression (br/gzip/deflate/zstd), signed cookies, multipart uploads, streaming/SSE, WebSockets, session middleware
- **Docs** — API docs page (`/docs`), auth UI page (`/ui`), uploads (`/upload`), `/robots.txt`

## Requirements

- [Bun](https://bun.sh) `>= 1.3.0`
- PostgreSQL reachable at `DATABASE_URL` (auth schema + migrations)
- [PostgREST](https://postgrest.org) reachable at `POSTGREST_URL` for application data
- Redis (or Valkey) reachable at `REDIS_URL` unless you pass `cache: createMemoryCache()`

## 1. New project (recommended)

```sh
bunx bun-backend-starter init my-app
cd my-app
bun install
# edit .env — BETTER_AUTH_SECRET, DATABASE_URL, POSTGREST_URL; start Redis
bun run db:migrate      # create auth + app schemas
bunx bun-backend-starter jwks   # export postgrest/jwks.json
bun run dev
```

Use `--force` to overwrite a non-empty directory.

The scaffold includes sample routes (`/api/health`, `/api/todos`) that show how to
extend the server, run PostgREST queries scoped to the caller's JWT, and publish
SSE events. See [`docs/postgrest.md`](docs/postgrest.md) for roles, RLS and the
PostgREST configuration.

## 2. Use as a library

```sh
bun add bun-backend-starter
```

```ts
import {
  createApp,
  createMemoryCache,
  publishRealtimeEvent,
  startServer,
  withRateLimit,
} from 'bun-backend-starter';

const { server, app, url } = await startServer({
  // Optional: skip Redis for local experiments
  // cache: createMemoryCache(),
  routes: {
    '/api/hello': {
      GET: withRateLimit('relaxed', () => Response.json({ message: 'hello' })),
    },
  },
});

console.log(`listening on ${url.href}`);

// Publish to authenticated clients on GET /realtime/events
await publishRealtimeEvent(app.events, {
  type: 'widget.created',
  data: { id: '1' },
  at: Date.now(),
});
```

Consumer `routes` are merged after built-ins; your path wins on conflict. Prefer `createApp()` when you want to own `Bun.serve` yourself:

```ts
const app = await createApp({
  /* options */
});
Bun.serve({
  routes: app.routes,
  fetch: app.fetchNotFound,
  error: app.onServeError,
  port: 3000,
});
```

See [`.env.example`](.env.example) for environment variables.

## 3. Run the built-in server as-is

```sh
bun add bun-backend-starter
# configure .env (BETTER_AUTH_SECRET + REDIS_URL)
bunx bun-backend-starter
# or: bunx bun-backend-starter start
```

## Develop this repository

```sh
bun install
cp .env.example .env        # then fill in BETTER_AUTH_SECRET, DATABASE_URL, POSTGREST_URL
bun run db:migrate:prd      # apply auth/app schema migrations
bun run dev:all             # starts local Redis (if installed) + the app with watch mode
bun test                    # unit + integration tests (starts a local PostgreSQL; or set TEST_DATABASE_URL)
bun run build               # bundles dist/ (library + CLI + types + migrations)
bun run start               # run the built server
```

## Publish

```sh
bun run build
bun publish                 # prepack runs build automatically
```

The package publishes `dist/` (bundled library + CLI + `.d.ts` types + SQL migrations), plus `README.md`, `LICENSE`, `.env.example`, and `docs/`.

## Agent skill

This repo ships a coding-agent skill that documents the whole framework
(scaffolding, auth, PostgREST data, jobs, storage, audit, security, flags,
billing, webhooks, MCP, realtime). Install it globally with the
[`skills`](https://github.com/vercel-labs/skills) CLI:

```sh
npx skills add streamwhite/hono-hands-on -g
```

Works with OpenCode, Claude Code, Codex, Cursor and others. The skill lives in
[`.opencode/skills/framework-development/`](.opencode/skills/framework-development/)
and is self-contained (main `SKILL.md` plus focused `references/*.md`).

## Docs

- [Database configuration](docs/database.md)
- [Two-factor, transactions, migrations & Unit of Work](docs/data-and-transactions.md)
- [PostgREST data layer (JWT + RLS)](docs/postgrest.md)
- [Config, logging, errors, audit & tasks](docs/framework-features.md)
- [ADR 0001: auth exception](docs/adr/0001-postgrest-auth-exception.md)
- [Realtime SSE example usage](docs/realtime-sse.md)

## License

MIT

## 功能范围

除了加密其他基本跟supabase这种一致,有些功能还没有.
