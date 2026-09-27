---
name: framework-development
description: >-
  Opinionated Bun backend framework. Use when
  developing new projects on this framework.
---

# Framework development

This project is an **opinionated backend framework**: easy to start a new
project, shipped as a single installable package (`bun-backend-starter`) so
framework updates sync to consumers through a version bump.

## Goal and scope

- **Goal**: make new backend projects fast to start; the framework is consumed
  as a package, not copied.
- **Scope**: common backend functionality.
- **Out of scope** (add per project, keep the core lean): businees logics.

## Core mental model

```
Consumer app
  └─ startServer(options) / createApp(options)   ← public entry points
       ├─ routing + middleware chain (src/middleware)
       ├─ Better Auth            → PostgreSQL `auth` schema (DATABASE_URL)
       ├─ PostgREST data client  → PostgreSQL `app` schema + RLS (POSTGREST_URL)
       ├─ cache (Redis cache-aside)
       ├─ BullMQ jobs (Redis)
       ├─ object storage (S3 / filesystem / memory)
       ├─ audit events + idempotency + rate limiting
       └─ realtime SSE + WebSocket
```

- **Auth exception**: Better Auth talks to Postgres directly for its own tables
  (`auth` schema). All _application_ data flows through PostgREST so RLS
  applies to a verified Better Auth JWT. See
  `docs/adr/0001-postgrest-auth-exception.md`.
- **Public API only**: consumers import from the package root (`src/index.ts`
  exports). Never depend on `src/*` internals from a consumer project.

## Where things live

| Area              | Module                                                   |
| ----------------- | -------------------------------------------------------- |
| App wiring        | `src/app.ts`, `src/server/start-server.ts`               |
| Routes + builtins | `src/server/serve-routes.ts`                             |
| Middleware        | `src/middleware/` (compose, registry, builtin/)          |
| Auth              | `src/auth/` (runtime, jwks, session-middleware)          |
| Data (PostgREST)  | `src/data/`                                              |
| DB + migrations   | `src/db/` (admin-client, migrate, migrations/)           |
| Jobs              | `src/tasks/` (BullMQ)                                    |
| Storage           | `src/storage/`                                           |
| Audit             | `src/audit/`                                             |
| Idempotency       | `src/http/idempotency.ts`                                |
| Rate limiting     | `src/http/rate-limit.ts` + `src/constants/rate-limit.ts` |
| Realtime / WS     | `src/realtime/`, `src/websocket/`                        |
| Config / logging  | `src/config/`, `src/observability/`                      |
| Errors            | `src/errors/`                                            |
| Scaffolding / CLI | `src/scaffold/`, `src/cli.ts`                            |
| Docs              | `docs/` (feature docs + `docs/adr/`)                     |

## New project workflow

```sh
bunx bun-backend-starter init my-app
cd my-app && bun install
# edit .env: BETTER_AUTH_SECRET, DATABASE_URL, POSTGREST_URL; start Redis
bun run db:migrate          # creates auth + app schemas
bunx bun-backend-starter jwks   # writes postgrest/jwks.json for PostgREST
bun run dev
```

Consumers extend via `startServer({ routes, middleware, websocket, ... })`.
Consumer routes are merged after built-ins and win on conflict.

## Development rules for this repo

- Use `bun` for everything; `bun test` runs unit + Postgres/Redis integration.
- New env vars go in `.env.example` and the relevant `src/constants/*.ts`
  (and `env.production` guidance when needed).
- Keep the public surface honest: add public API to `src/index.ts`.

## Common tasks

- **Add a route**: extend `routes` passed to `startServer`, or add a builtin in
  `src/server/serve-routes.ts`.
- **Add middleware**: implement `Middleware` and pass via
  `createApp({ middleware: [...] })`, or register with `createMiddlewareRegistry()`.
- **Validate input**: `withValidation(parser, { target })` + `readValidated(ctx)`.
- **Require a session**: `withSession()` then `readUser(ctx)`.
- **Read/write app data**: `app.data.withToken(userJwt).from("table").select()`.
- **Background work**: `app.tasks.run(name, handler, payload)` (BullMQ).
- **Files**: `app.storage.put/get/head/delete`, `parseMultipartUpload(req)`.
- **Audit**: `app.audit({ action })` or `auditRules` for path-based auditing.
- **Idempotency**: set `idempotencyPaths` and require `Idempotency-Key`.
- **Realtime**: `publishRealtimeEvent(app.events, ...)` (SSE) or a websocket
  endpoint via `createApp({ websocket: [...] })`.
- **Shutdown**: `createGracefulShutdown({ logger, steps }).installSignalHandlers()`.

## Reference
