# Testing this framework

`bun test` runs the suite. `tests/` is the source of truth for how the framework
is expected to behave. This file defines what to test and how, so new tests stay
useful as the framework becomes the base for new projects.

## Scope rule: test the framework, not its dependencies

The framework is mostly wiring around well-tested libraries and platform APIs.
Tests exist to protect **our** logic, not to re-verify someone else's.

**Test (framework-owned logic):**

- routing, middleware composition and ordering (`src/server`, `src/middleware`)
- config/env resolution and defaults (`src/config/env.ts`, `src/constants/*`)
- security guards: CSRF, SSRF, brute-force, sanitization, request/rate limits
- cache keys, invalidation and cache-aside semantics (`src/cache`)
- auth **bridging** we own: session middleware, secondary storage adapter,
  passkey limit, session rotation
- migrations path resolution, transaction/unit-of-work helpers (`src/db`)
- the PostgREST query builder and error mapping (`src/data`)
- storage driver selection, mail resolution, feature-flag provider adapter
- realtime bridges: SSE framing, Redis pub/sub ref-counting, event bus
- error classes and HTTP error mapping
- app wiring and public options (`src/app.ts`, `src/server/start-server.ts`)

**Do not test (thin wrappers / upstream behavior):**

- `Bun.serve` routing internals, `fetch`, `Request`/`Response`
- the Bun Redis client, ioredis, BullMQ, the S3 SDK, the OpenFeature SDK,
  better-auth internals, PostgREST's own protocol/JSON handling
- generated HTML with no logic, or constants that are just literals
- the same behavior already covered by an integration test

If a module only forwards arguments to a library and has no branches or
transformation of its own, it does not need a unit test. Test the layer around
it instead (the place where framework decisions are made).

## How to test

- **Unit first.** Prefer small tests with injected fakes over infra. Examples:
  `tests/helpers/app-memory.ts` builds a `createApp` with in-memory cache,
  storage, event bus and noop task queue; `tests/postgrest-client.test.ts` uses a
  fake `fetch`.
- **Integration only when the framework adds behavior on top of infra.**
  - Postgres: `tests/helpers/test-db.ts` (`createTestDatabase`, `queryPg`,
    `PG_AVAILABLE`) spins up a managed cluster.
  - Redis: `tests/helpers/test-redis.ts` (`getTestRedisUrl`, `REDIS_AVAILABLE`)
    starts a managed server for the process. Use it for things like the atomic
    Lua rate-limit counter and the pub/sub event bus; do not assert raw Redis
    command behavior.
- **Gate on availability, don't fail.** Wrap infra tests in
  `describe.skipIf(!PG_AVAILABLE)` / `describe.skipIf(!REDIS_AVAILABLE)` so the
  suite still passes where the binary is missing.
- **Group by feature** in `tests/<feature>.test.ts`; add to the existing file
  when the feature already has one. Use the `@/` absolute import alias.
- **No real network, no fixed ports, no sleeps where a helper can wait.**
  Inject fakes or use `Bun.serve({ port: 0 })`.
- **Deterministic.** Freeze or inject time; never depend on wall-clock ordering.
  Clean up servers/DBs via `tests/dispose-guard.ts` (`scheduleTestDispose`) or
  `afterAll`.

## Definition of done for a change

1. When fixing a bug, add a regression test that fails without the fix.
2. When adding framework logic, add a focused test for the new branch.
3. Run the tests for the files you changed, then the full suite
   (`bun test --coverage`); it must be green. Fix the code, not the expectation.
4. Coverage is a signal, not a goal: never add tests that only re-assert a
   dependency's behavior to move a number.
