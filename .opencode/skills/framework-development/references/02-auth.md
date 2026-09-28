# Authentication (Better Auth)

Better Auth persists to PostgreSQL's `auth` schema over `pg` (`DATABASE_URL`) —
the one allowed direct-DB path. It issues a session cookie plus short-lived
access JWTs (EdDSA, `role: "authenticated"`) exposed at `/api/auth/jwks`, which
PostgREST verifies. **All application data still goes through PostgREST.**

Enabled plugins: email/password, username, JWT, bearer, two-factor (email OTP +
TOTP + backup codes), passkeys/WebAuthn.

## Sessions in routes

```ts
import { compose, withSession, readUser, readSession, bearerToken } from "bun-backend-starter";

const handler = compose([withSession()], async (ctx) => {
  const user = readUser(ctx);        // { id, email, name?, username? }
  const session = readSession(ctx);  // { user, session } | undefined
  return Response.json({ user });
});
```

| Export | Signature / behavior |
| --- | --- |
| `withSession(stateKey = "session")` | Middleware; requires a session (cookie or bearer) or throws `UnauthorizedError`. Sets `ctx.state.session` and `ctx.state.user`. |
| `getOptionalSession(ctx)` | `Promise<SessionInfo \| null>`; no throw. |
| `readSession(ctx)` | `SessionInfo \| undefined` (reads `ctx.state.session`). |
| `readUser(ctx)` | `SessionUser \| undefined` (reads `ctx.state.user`). |
| `bearerToken(req)` | Extracts the bearer token from `Authorization`. |

Prefer `withSession()` for routes; it validates the token against Better Auth.
`getOptionalSession` / `readSession` are useful when a route works for both
anonymous and signed-in callers.

## Sensitive-operation step-up ("sudo mode")

High-risk handlers require a **fresh** session or a recent password re-check.

```ts
import {
  withSensitiveOperation, requireSensitiveVerification,
  createSensitiveVerifyStore, isSessionFresh,
} from "bun-backend-starter";

const store = createSensitiveVerifyStore(app.cache, 300);

const deleteAccount = withSensitiveOperation(
  { auth: app.auth, store, freshAgeSeconds: 3600 },
  async (req) => new Response(null, { status: 204 }),
);

// Imperative:
const denied = await requireSensitiveVerification(req, { auth: app.auth, store, freshAgeSeconds: 3600 });
if (denied) return denied;
```

- No session → `401`. Stale and unverified → `403` with
  `code: "SENSITIVE_VERIFICATION_REQUIRED"`. Verified/fresh → passes.
- `isSessionFresh(createdAtMs, freshAgeSeconds, nowMs)`; `freshAgeSeconds <= 0`
  disables the freshness requirement.
- `POST /api/auth/session/verify` with `{ password }` marks the session verified
  (TTL `SENSITIVE_VERIFY_TTL_SECONDS`, default 300s). Uses the authoritative
  session (bypasses the cookie cache). Users without a password get `400`.
- `createSensitiveVerifyStore(cache, ttlSeconds)` returns `{ mark, isVerified, clear }`.

## Session rotation

`POST /api/auth/session/rotate` deletes the current session and issues a new
token + cookie (`set-auth-token` header). It is guarded by
`withSensitiveOperation`, so callers must re-verify first. Built-in
`changePassword` / `deleteUser` / passkey add are protected by Better Auth's own
freshness checks.

## Better Auth HTTP surface

`GET`/`POST` on `/api/auth` and `/api/auth/*` (strict rate limit, 64 KiB JSON
cap). Common paths: `sign-up/email`, `sign-in/email`, `sign-out`, `get-session`,
`token` (access JWT), `request-password-reset`, `reset-password`,
`verify-email`, `send-verification-email`, `two-factor/*`, `passkey/*`,
`list-sessions`, `revoke-session`, `revoke-other-sessions`, plus
`session/verify` and `session/rotate` above.

Two-factor: enable with `POST /api/auth/two-factor/enable` `{ password, method: "otp" | "totp" }`;
TOTP enable returns `totpURI` + `backupCodes`. Verify via `two-factor/verify-otp`
/ `verify-totp` / `verify-backup-code`.

## Passkeys

WebAuthn endpoints under `/api/auth/passkey/*`; the number per user is capped by
`maxPasskeysPerUser` / `MAX_PASSKEYS_PER_USER` (default 5). `rpID`/origin derive
from `BETTER_AUTH_URL`; production must be HTTPS.

## JWKS for PostgREST

```sh
bunx bun-backend-starter jwks          # writes postgrest/jwks.json
```

```ts
import { buildPublicJwks, writeJwksFile } from "bun-backend-starter";
const jwks = await buildPublicJwks(app.auth);
```

Re-run after key rotation, then reload PostgREST. `AUTH_JWKS_PATH` =
`/api/auth/jwks`; `AUTH_SESSION_VERIFY_PATH`; `AUTH_JWT_ROLE_CLAIM` (`role`),
`AUTH_JWT_ROLE_AUTHENTICATED` (`authenticated`).

## Session / JWT tuning

| Env var | Default | Meaning |
| --- | --- | --- |
| `SESSION_EXPIRES_IN_SECONDS` | `604800` (7d) | Sliding session lifetime. |
| `SESSION_UPDATE_AGE_SECONDS` | `86400` (1d) | Refresh threshold. |
| `ACCESS_JWT_EXPIRATION` | `15m` | Access JWT lifetime. |
| `COOKIE_CACHE_MAX_AGE_SECONDS` | `300` | Cookie cache. |
| `SESSION_FRESH_AGE_SECONDS` | `3600` | Freshness window for sensitive ops (<=0 disables). |
| `SENSITIVE_VERIFY_TTL_SECONDS` | `300` | Re-verification validity. |
| `MAX_PASSKEYS_PER_USER` | `5` | Passkey cap. |

## Gotchas

- **Auth exception:** never route business queries through `DATABASE_URL`; use
  `app.data`. See `docs/adr/0001-postgrest-auth-exception.md`.
- `readSession`/`readUser` require `withSession` earlier in the chain.
- A custom `withSession(stateKey)` still sets `ctx.state.user`, but
  `readSession` only reads `ctx.state.session`.
- `requireEmailVerification` is `false` by default even though verification
  emails are configured.
- Rotation is destructive: the old token is deleted before the new one is issued.
