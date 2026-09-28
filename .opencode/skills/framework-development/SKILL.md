---
name: framework-development
description: >-
  Build backends on the bun-backend-starter framework (Bun + Bun.serve route
  handlers). Covers installing/scaffolding a project, createApp/startServer
  wiring, the public API, routes and middleware, Better Auth (passkeys, 2FA,
  sessions, sensitive step-up), PostgreSQL + PostgREST data access with RLS,
  migrations, transactions and Unit of Work, pagination, Redis/memory cache,
  BullMQ jobs, object storage, audit, idempotency, rate limiting, request
  limits, CSRF, brute-force lockout, SSRF/safe-fetch, bot detection, realtime
  SSE and WebSockets, feature flags, billing entitlements, inbound/outbound
  webhooks, and an MCP endpoint. Use when starting or extending a Bun backend
  with this framework, when asking how a framework feature works, or when
  editing this repository.
---

# Developing with the `bun-backend-starter` framework

`bun-backend-starter` is an **opinionated, production-ready Bun backend shipped as
an installable package**. Consumers install it and extend it through a small public
API; they never copy its internals. Framework updates reach consumers through a
version bump.

- **Package name / import specifier:** `bun-backend-starter`
- **Runtime:** Bun `>= 1.3.0`
- **Goal:** make a new backend fast to start.
- **Out of scope:** your business logic, plus optional modules you add per project.

## When to use this skill

Use it when the task mentions `bun-backend-starter`, `createApp`, `startServer`,
Bun backend scaffolding with this framework, or when working inside this
repository. Load only the reference files relevant to the task (see the index).

## Core mental model

```
Consumer app
  └─ startServer(options) / createApp(options)      ← public entry points
       ├─ routing + middleware chain              (src/middleware, src/server)
       ├─ Better Auth        → PostgreSQL auth schema (DATABASE_URL, direct pg)
       ├─ PostgREST client   → PostgreSQL app schema + RLS (POSTGREST_URL)
       ├─ cache (Redis, or in-memory LRU)
       ├─ BullMQ jobs (Redis)
       ├─ object storage (S3 / filesystem / memory)
       ├─ audit + idempotency + rate limiting + security guards
       ├─ feature flags + billing entitlements
       ├─ webhooks (outbound delivery, inbound verification)
       ├─ MCP endpoint (/mcp)
       └─ realtime SSE + WebSocket
```

## Golden rules

1. **Auth is the one direct-database exception.** Better Auth writes its own
   `auth` schema over `pg` via `DATABASE_URL`. Everything else (application data)
   must go through PostgREST (`app.data` / `POSTGREST_URL`) so RLS applies to the
   verified Better Auth JWT. See `references/03-data-postgrest.md` and
   `docs/adr/0001-postgrest-auth-exception.md`.
2. **Public API only.** Import from `bun-backend-starter`. Never depend on
   `src/*` internals from a consumer project.
3. **Consumer routes win.** `routes`, `middleware` and `websocket` passed to
   `startServer`/`createApp` are merged after the built-ins.
4. **Bun for everything.** `bun install`, `bun test`, `bun run dev`.
5. **Validate input and check authorization in every route.** RLS protects rows,
   not request bodies.

## Quick start (new project)

```sh
bunx bun-backend-starter init my-app
cd my-app && bun install
# edit .env: BETTER_AUTH_SECRET (>=32 chars), DATABASE_URL, POSTGREST_URL; start Redis
bun run db:migrate              # creates auth + app schemas
bunx bun-backend-starter jwks   # writes postgrest/jwks.json for PostgREST
bun run dev
```

The scaffold writes `src/index.ts` with sample routes (`/api/health`,
`/api/todos`) showing routes, validation, PostgREST reads scoped to the caller's
JWT, audit, realtime events and background jobs.

## Minimal wiring

```ts
import { startServer, withRateLimit } from "bun-backend-starter";

const { server, app, url } = await startServer({
  idempotencyPaths: ["/api/todos"],
  auditRules: [{ path: "/api/todos", action: "data.created", targetType: "todo" }],
  routes: {
    "/api/hello": {
      GET: withRateLimit("relaxed", () => Response.json({ ok: true })),
    },
  },
});
console.log(`listening on ${url.href}`);
```

Prefer `createApp(options)` when you want to own `Bun.serve` yourself; it returns
`{ routes, fetchNotFound, onServeError, ... }`.

## Reference index

Read only the file(s) that match the task. Paths are relative to this skill.

| File | Read when you need |
| --- | --- |
| `references/00-getting-started.md` | Scaffolding, CLI commands, env vars, built-in routes, project layout, dev workflow. |
| `references/01-app-options.md` | Every `CreateAppOptions` field and `AppInstance` member, with defaults. |
| `references/02-auth.md` | Better Auth setup, sessions (cookie/bearer/JWT), 2FA, passkeys, session rotation, sensitive-operation step-up, JWKS. |
| `references/03-data-postgrest.md` | `app.data` query builder, RLS, client-side access, migrations, transactions, Unit of Work, pagination. |
| `references/04-http-middleware.md` | Route/middleware model, validation, cookies, multipart uploads, streaming/SSE helpers, CORS, compression, rate limits, request limits. |
| `references/05-cache-jobs-storage.md` | `app.cache`, BullMQ `app.tasks`, `app.storage`, mailer. |
| `references/06-audit-idempotency.md` | `app.audit`, audit sinks/rules, `Idempotency-Key` protection. |
| `references/07-realtime-websocket.md` | Realtime SSE events and WebSocket endpoints. |
| `references/08-security.md` | Bot detection, CSRF, brute-force lockout, SSRF checks, `safeFetch`, sanitize helpers. |
| `references/09-flags-billing.md` | Feature flags and billing/entitlement gating. |
| `references/10-webhooks.md` | Outbound signed webhook delivery and inbound signature verification. |
| `references/11-mcp.md` | Exposing the app as an MCP (Model Context Protocol) server. |
| `references/12-config-errors-observability.md` | Config validation, logging, error classes, graceful shutdown. |

## Developing this repository

```sh
bun install
cp .env.example .env        # fill BETTER_AUTH_SECRET, DATABASE_URL, POSTGREST_URL
bun run db:migrate:prd
bun run dev                 # watch mode
bun test                    # unit + integration (needs Postgres/Redis, or TEST_DATABASE_URL)
bun run build               # bundles dist/ (library + CLI + types + migrations)
bun run lint                # biome
```

- New env vars go in `.env.example` and the matching `src/constants/*.ts`.
- Add public API to `src/index.ts` (the package's only export entry).
- `docs/` holds longer feature docs; `docs/adr/` records decisions.
