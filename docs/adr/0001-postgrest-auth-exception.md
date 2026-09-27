# ADR 0001: PostgREST for app data with an explicit auth exception

- Status: Accepted
- Date: 2026-09-26

## Context

The framework must stop shipping SQLite and serve application data through a
PostgREST HTTP API. PostgREST authorizes requests with a JWT that carries a
`role` claim, then applies PostgreSQL row-level security (RLS). Better Auth,
however, is a library that talks to a database driver directly
(`pg` / `better-sqlite3`) and has no supported HTTP data API. Translating Better
Auth's SQL through PostgREST would mean maintaining a fragile SQL-to-REST shim.

## Decision

Treat authentication as an explicit exception:

- **Better Auth** persists to PostgreSQL in a dedicated `auth` schema over a
  direct `pg` connection (`DATABASE_URL`). It issues a Better Auth session cookie
  plus short-lived access JWTs (EdDSA, JWKS at `/api/auth/jwks`) that carry
  `role: "authenticated"` and standard `sub`/`iat`/`exp` claims.
- **Application data** is served exclusively by **PostgREST**, which verifies the
  Better Auth JWT against the exported JWKS and `SET ROLE`s to the token's
  `role` claim. RLS policies in the `app` schema use `auth.uid()` / `auth.jwt()`.
- `POSTGREST_URL` is the only runtime data path. `DATABASE_URL` is used by
  migrations, seed and Better Auth only; it is never a business-query channel.

```
Browser/Service ──► Better Auth ──► PostgreSQL auth.*   (DATABASE_URL, pg)
        │
        └────────► PostgREST ──► verify JWT (JWKS) ──► SET ROLE ──► RLS on app.*
```

`auth.uid()` and `auth.jwt()` read `request.jwt.claims`, which PostgREST sets per
request. This matches the widely used Supabase model and needs no custom DB
driver.

## Consequences

- The framework ships a `jwks` command that exports the public JWKS to a file
  (`postgrest/jwks.json`) that PostgREST loads through `jwt-secret = "@..."`.
  Signing keys are created lazily by Better Auth; run the command once after the
  first deploy and after key rotation, then reload PostgREST.
- Migrations create the `auth` and `app` schemas and the `auth.uid()` helpers.
  Database roles, grants and RLS policies are environment-specific and are
  bootstrapped separately (`postgrest/bootstrap.sql`).
- Two connection strings exist by design: `DATABASE_URL` (privileged, server
  side) and `POSTGREST_URL` (HTTP, RLS-scoped). Do not expose `DATABASE_URL` or
  `POSTGREST_SERVICE_TOKEN` to clients.
- Tests run against a real PostgreSQL instance (`TEST_DATABASE_URL` or a
  locally started cluster); there is no SQLite fallback.

## Alternatives considered

1. **SQLite retained** — rejected: the framework standardizes on PostgreSQL +
   PostgREST.
2. **Better Auth over PostgREST** — rejected: unsupported by Better Auth and
   would require an unmaintainable SQL-to-REST adapter, with no transaction
   semantics.
3. **Symmetric JWT secret shared with PostgREST** — rejected: Better Auth signs
   with asymmetric EdDSA keys, and shipping a symmetric secret is weaker than
   publishing a public JWKS.
