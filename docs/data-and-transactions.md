# Two-factor auth, transactions, migrations & Unit of Work

## Two-factor authentication (email OTP + TOTP)

Better Auth's two-factor plugin is enabled with **email OTP** and **TOTP**
(authenticator apps), plus **backup codes**.

### Email OTP

1. User signs in and enables 2FA (requires password):
   `POST /api/auth/two-factor/enable` with `{ password, method: "otp" }`.
2. Request a code: `POST /api/auth/two-factor/send-otp`. The code is emailed
   through the configured mailer.
3. Verify: `POST /api/auth/two-factor/verify-otp` with `{ code }`.

### TOTP (authenticator apps)

1. Enable: `POST /api/auth/two-factor/enable` with
   `{ password, method: "totp" }`. The response includes `totpURI`
   (`otpauth://totp/<issuer>:<email>?secret=...`) and `backupCodes`. Show
   `totpURI` as a QR code in your UI.
2. The user scans it and submits a code:
   `POST /api/auth/two-factor/verify-totp` with `{ code }`.
3. Backup codes: `POST /api/auth/two-factor/verify-backup-code` with `{ code }`
   (also `POST /api/auth/two-factor/generate-backup-codes` to regenerate).

The authenticator derives codes from the base32 secret inside `totpURI`; the
server compares against the same secret, so any standard app (Google
Authenticator, 1Password, …) works.

Tuning via env:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TWO_FACTOR_ISSUER` | `Backend Template` | Issuer shown in authenticator apps |
| `TWO_FACTOR_TOTP_DIGITS` | `6` | TOTP code length (`6` or `8`) |
| `TWO_FACTOR_TOTP_PERIOD_SECONDS` | `30` | TOTP time step |
| `TWO_FACTOR_OTP_DIGITS` | `6` | Email OTP length |
| `TWO_FACTOR_OTP_PERIOD_MINUTES` | `3` | Email OTP lifetime |
| `TWO_FACTOR_OTP_ATTEMPTS` | `5` | Allowed email OTP attempts |

Storage lives in the `auth` schema (`auth.twoFactor`, `auth.user.twoFactorEnabled`),
created by migration `0002_two_factor`.

## Migrations

SQL migrations live in `src/db/migrations/` with `meta/_journal.json`. They are
applied in journal order and recorded in `__drizzle_migrations`.

```sh
bun run db:migrate:prd        # apply pending migrations
bun run db:migrate:status     # show applied/pending state
bun run db:seed               # migrate + seed demo users
```

Programmatic helpers:

```ts
import { createAdminDb, closeAdminDb, migrationStatus, pendingMigrations } from "bun-backend-starter";

const db = await createAdminDb();       // connects + applies migrations
const status = await db.migrationStatus();
await closeAdminDb(db);

const pending = await pendingMigrations(sql); // tags not yet applied
```

Runtime startup never auto-migrates; run migrations as an explicit deploy step.

## Transactions

PostgREST is HTTP-based, so a single request is one transaction. There are two
correct ways to get atomicity:

### 1. Database functions (RPC) — recommended for app data

Put multi-statement logic in a PostgreSQL function and call it once over
PostgREST. The function runs in one transaction server-side.

```ts
import { runInTransaction } from "bun-backend-starter";

const result = await runInTransaction<{ id: string }>(
  app.data!.withToken(userJwt),
  "complete_todo",
  { todo_id: id },
);
```

```sql
create function app.complete_todo(todo_id uuid) returns app.todos
language plpgsql security invoker as $$
declare row app.todos;
begin
  update app.todos set done = true where id = todo_id returning * into row;
  insert into app.audit (todo_id) values (todo_id);
  return row;
end $$;
```

### 2. Server-side transactions — privileged multi-step work

Use the admin connection for trusted server operations (jobs, admin actions).
`withTransaction` wraps `BEGIN`/`COMMIT` and rolls back on any throw.

```ts
import { withTransaction, withSavepoint } from "bun-backend-starter";

await withTransaction(db.sql, async (tx) => {
  await tx`insert into app.orders (id) values (${id})`;
  await withSavepoint(tx, async (sp) => {   // partial rollback
    await sp`insert into app.audit (order_id) values (${id})`;
  });
});
```

## Unit of Work

A Unit of Work groups related steps into one transaction. Register steps with
`register`; they run in order and all roll back if any step throws. Always use
the `tx` handle passed to each step so it participates in the transaction.

```ts
import { createUnitOfWork } from "bun-backend-starter";

const result = await createUnitOfWork(db.sql, (register) => {
  register((tx) => tx`insert into app.orders (id, total) values (${id}, ${total})`);
  register((tx) => tx`update app.inventory set qty = qty - 1 where sku = ${sku}`);
  register((tx) => tx`insert into app.audit (action) values ('order.created')`);
  return { orderId: id };
}).execute();
```

Guidelines:

- One Unit of Work = one business operation. Keep it short; don't call external
  services inside (network calls can't roll back).
- Publish events *after* commit (from the resolved result), not inside the
  transaction.
- For user-scoped data over PostgREST, prefer an RPC function over a client-side
  Unit of Work — it keeps RLS/role enforcement in the database.
