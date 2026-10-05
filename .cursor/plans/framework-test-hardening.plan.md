---
name: Framework test hardening
overview: Raise test coverage of corymb's own logic (not thin wrappers of third-party APIs/Bun built-ins) so the framework can be a stable base for new projects. Add unit tests with fakes plus a few managed-Redis integration tests for framework-owned infrastructure behavior, and document the testing rule in the framework-development skill.
todos:
  - id: principles
    content: Add testing principles reference (references/13-testing.md) to the framework-development skill and link it from SKILL.md
    status: completed
  - id: config-env
    content: tests/config-env.test.ts - config/env readers + constants env resolution (redis, shutdown, pagination, flags, bcrypt, server, bot, env-int)
    status: completed
  - id: cache
    content: tests/cache-keys.test.ts - namespaced keys, invalidateUser/invalidateSession, corrupt-cache fallback
    status: completed
  - id: secondary-storage
    content: tests/secondary-storage.test.ts - TTL fallback, getAndDelete, increment, delete
    status: completed
  - id: session-middleware
    content: Extend tests/session-middleware.test.ts - withSession/readSession/readUser/resolveActorId with a fake auth API
    status: completed
  - id: http-guards
    content: tests/json-body.test.ts + tests/with-rate-limit.test.ts
    status: completed
  - id: security
    content: tests/sanitize-ssrf.test.ts - escapeHtml/stripHtml/sanitizeStrings plus SSRF private/wildcard/invalid cases
    status: completed
  - id: mail
    content: tests/mail.test.ts - link builders, bodies, resolveMailer, console/in-memory mailers
    status: completed
  - id: flags-db
    content: tests/migrations-path.test.ts + extend tests/feature-flags.test.ts (corrupt cache fallback, named domain, listFlags). Storage driver selection was already covered by tests/storage.test.ts, so no new file there.
    status: completed
  - id: postgrest-builder
    content: tests/postgrest-builder.test.ts - fluent builder methods, upsert/update/delete/range/count/single, network + no-row error mapping
    status: completed
  - id: redis-integration
    content: tests/redis-event-bus.test.ts + rate-limit/cache-aside now run against the managed test Redis (Lua counter, bundle factory, error fallbacks)
    status: completed
  - id: verify
    content: Full suite green at 94.91% funcs / 94.58% lines, 384 pass / 2 skip / 0 fail (was 88.24 / 88.36, 296 pass / 5 skip)
    status: completed
isProject: false
---

# Framework test hardening

## Why

`corymb` is becoming the base for new projects. The existing suite (61 files,
~296 tests) is broad, but coverage of some **framework-owned logic** is thin
(cache invalidation, secondary storage, session middleware, config/env
resolution, query-builder methods, Redis pub/sub bridge, mail resolution,
storage driver resolution).

## Scope rule (from the project owner)

- **Test**: logic the framework itself implements — routing/middleware
  composition, config/env resolution, security guards, cache keys + invalidation,
  auth session bridging, migrations path resolution, PostgREST query builder,
  storage driver selection, realtime/Redis bridges, error mapping.
- **Do not test**: thin pass-through wrappers of third-party libraries or
  platform APIs (Bun.serve, ioredis/Bun Redis client, BullMQ, S3 SDK, OpenFeature
  SDK, PostgREST HTTP itself, better-auth internals). Those are already covered by
  consumers/upstream and by the existing integration suite.
- Keep tests essential, deterministic, and grouped by feature. No real network.
  Use fakes for unit logic; use the managed Postgres/Redis helpers only where the
  framework adds behavior on top of infrastructure (atomic Lua counter, pub/sub
  ref-counting).

## Measured baseline

`bun test --coverage`: **88.24% funcs / 88.36% lines**, 296 pass / 5 skip / 0 fail.

Notable gaps targeted here (funcs/lines):

| Module | Before |
| --- | --- |
| `src/http/rate-limit-redis.ts` | 0 / 10 |
| `src/realtime/redis-event-bus.ts` | 0 / 6 |
| `src/auth/secondary-storage.ts` | 75 / 8 |
| `src/auth/session-middleware.ts` | 50 / 62 |
| `src/cache/cache-aside.ts` | 75 / 77 |
| `src/constants/redis.ts` | 17 / 4 |
| `src/data/postgrest-builder.ts` | 46 / 71 |
| `src/flags/openfeature-provider.ts` | 50 / 55 |
| `src/constants/shutdown.ts` | 50 / 18 |
| `src/constants/pagination.ts` | 0 / 65 |
| `src/mail/mail-bodies.ts` | 20 / 18 |

## Deliverables

### 1. Skill documentation

Add `.opencode/skills/framework-development/references/13-testing.md` and index
it in `SKILL.md`. It encodes the scope rule above, the pattern for fakes vs
managed infra, where helpers live, and the "bug -> regression test" rule.

### 2. New/updated tests

| File | Covers |
| --- | --- |
| `tests/config-env.test.ts` | `config/env.ts` readers; `constants/env-int`, `redis`, `shutdown`, `pagination`, `flags`, `bcrypt-cost`, `server`, `bot` resolvers |
| `tests/cache-keys.test.ts` | `cache/keys`, `cache/invalidate`, corrupt cached JSON fallback |
| `tests/secondary-storage.test.ts` | better-auth secondary storage adapter (framework side) |
| `tests/session-middleware.test.ts` (extend) | `withSession`, `readSession`, `readUser`, `resolveActorId` via fake auth |
| `tests/json-body.test.ts` | size guard (header + body) and invalid JSON |
| `tests/with-rate-limit.test.ts` | pass-through, 429 + `Retry-After`, default limiter reset |
| `tests/sanitize-ssrf.test.ts` | HTML escaping/stripping, recursive sanitize, SSRF private/wildcard/invalid |
| `tests/mail.test.ts` | link builders, bodies, mailer resolution and implementations |
| `tests/feature-flags.test.ts` (extend) | corrupt-cache fallback, named OpenFeature domain, `listFlags` enumeration |
| `tests/migrations-path.test.ts` | env override, missing-journal error |
| `tests/postgrest-builder.test.ts` | builder methods and error/tolerate mapping |
| `tests/redis-event-bus.test.ts` | pub/sub fan-out, ref-counted unsubscribe, unreachable fallback |
| `tests/rate-limit.test.ts`, `tests/cache-aside.test.ts` (extend) | run Redis tests against the managed test Redis |

## Verify

Run each new file in isolation, then the full `bun test --coverage` and confirm
0 fail with improved coverage.
