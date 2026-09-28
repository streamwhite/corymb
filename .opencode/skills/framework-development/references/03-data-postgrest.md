# Data: PostgreSQL + PostgREST

Application data is served by PostgREST, which verifies the Better Auth JWT
against the exported JWKS, `SET ROLE`s, and applies PostgreSQL row-level security
on the `app` schema. `app.data` is the server-side client. `DATABASE_URL` is
**not** a business-query channel.

## `app.data` — PostgREST client

```ts
const { data } = await app.data!
  .withToken(userJwt)            // forward the caller's JWT → RLS applies
  .from("todos")
  .select("id,title,done")
  .eq("done", false)
  .order("created_at", { ascending: false });

// Privileged (service-token) request — no .withToken():
await app.data!.from("audit_log").insert({ actor, action });

// Atomic multi-statement work:
await app.data!.withToken(userJwt).rpc("complete_todo", { todo_id: id });
```

`PostgrestClient`:

| Member | Purpose |
| --- | --- |
| `from<T>(table)` | Returns a `PostgrestBuilder<T>`. |
| `rpc<T>(fn, args?)` | `POST /rpc/<fn>`; returns `Promise<PostgrestResponse<T>>`. |
| `withToken(token)` | Bound to the caller's JWT. |
| `as(auth)` / `anonymous()` | Bind `{ kind: "token" }` / `{ kind: "anonymous" }`. |
| `schema` | Target schema (default `app`). |
| `health()` | Reachability probe (used by `/ready`). |

`PostgrestBuilder` is thenable (await it). Methods: `select(columns?)`, `insert`,
`upsert(values, { onConflict })`, `update`, `delete`, filters (`eq`, `neq`, `gt`,
`gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in`, generic `filter(op, col, val)`),
`order(col, { ascending })`, `limit(n)`, `range(from, to)`, `count()`, `single()`.
Non-2xx throws `PostgrestError`; success is `{ data, count, status }`.

## Client-side access (browser/mobile)

```ts
const { token } = await fetch("/api/auth/token", { credentials: "include" }).then((r) => r.json());
const res = await fetch(`${POSTGREST_URL}/todos?select=*`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

## RLS + roles

`auth.uid()` / `auth.jwt()` read the request JWT claims. Typical policy:

```sql
alter table app.todos enable row level security;

create policy "owners read their todos" on app.todos
  for select to authenticated using (owner_id = auth.uid());

create policy "owners write their todos" on app.todos
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

Use `postgrest/bootstrap.sql` for roles/grants and
`postgrest/postgrest.conf.example` for config. Never expose `DATABASE_URL` or
`POSTGREST_SERVICE_TOKEN` to clients; RLS is not input validation.

Config: `POSTGREST_URL`, `POSTGREST_SCHEMA` (`app`), `POSTGREST_SERVICE_TOKEN`,
`POSTGREST_TIMEOUT_MS` (10000).

## Migrations

SQL files live in `src/db/migrations/` with `meta/_journal.json`; applied in
journal order and recorded in `__drizzle_migrations`. Runtime startup never
auto-migrates.

```sh
bun run db:migrate:prd       # apply pending
bun run db:migrate:status    # applied/pending
bun run db:seed              # migrate + seed demo users
```

```ts
import { createAdminDb, closeAdminDb, migrationStatus, pendingMigrations } from "bun-backend-starter";

const db = await createAdminDb();
const status = await db.migrationStatus();
await closeAdminDb(db);
```

## Transactions & Unit of Work

- **App data (RLS):** put multi-statement logic in a PostgreSQL function and call
  it once via `runInTransaction(client, fn, args)` → `app.data.withToken(jwt).rpc`.
  The function runs in one server-side transaction.
- **Privileged server work:** use the admin connection.

```ts
import { withTransaction, withSavepoint, createUnitOfWork } from "bun-backend-starter";

await withTransaction(db.sql, async (tx) => {
  await tx`insert into app.orders (id) values (${id})`;
  await withSavepoint(tx, async (sp) => {           // partial rollback
    await sp`insert into app.audit (order_id) values (${id})`;
  });
});

const result = await createUnitOfWork(db.sql, (register) => {
  register((tx) => tx`insert into app.orders (id, total) values (${id}, ${total})`);
  register((tx) => tx`update app.inventory set qty = qty - 1 where sku = ${sku}`);
  return { orderId: id };
}).execute();
```

One Unit of Work = one business operation. Always use the `tx` handle passed to
each step. Don't call external services inside; publish events after commit.

## Pagination

Pure helpers over `URLSearchParams` (offset/page **or** cursor). Cursor encoding
is opaque base64url JSON — not signed; never put secrets in it.

```ts
import { parsePagination, applyPageRange, toPage } from "bun-backend-starter";

const params = parsePagination(new URL(req.url).searchParams);   // { page, pageSize, offset, limit }
const builder = app.data!.from("posts").select("*").count();      // count() needed for accurate total
const page = toPage(await applyPageRange(builder, params), params);
return Response.json(page);                                       // { data, meta: PageMeta }
```

Cursor flow:

```ts
import { parseCursorPagination, decodeCursor, applyCursorLimit, buildCursorPage } from "bun-backend-starter";

const { limit, cursor } = parseCursorPagination(new URL(req.url).searchParams);
let builder = app.data!.from("posts").select("*").order("id");
if (cursor) builder = builder.gt("id", decodeCursor<{ id: number }>(cursor).id);
const rows = (await applyCursorLimit(builder, limit)).data;       // over-fetches limit + 1
return Response.json(buildCursorPage(rows, limit, (row) => ({ id: row.id })));
```

Query params: `page` + `pageSize`, or `offset` + `limit` (`limit` wins), or
`cursor` + `limit`. `PageMeta = { page, pageSize, total, totalPages, hasNext, hasPrev }`;
`CursorMeta = { limit, count, hasMore, nextCursor? }`. Invalid input throws
`ValidationError` (400). Defaults come from `PAGINATION_PAGE_SIZE` (20) /
`PAGINATION_MAX_PAGE_SIZE` (100) via `resolvePaginationConfigFromEnv()` — pass
them to `parsePagination` explicitly; the helpers don't read env themselves.

Exports: `parsePagination`, `parseCursorPagination`, `buildPageMeta`,
`encodeCursor`, `decodeCursor`, `buildCursorPage`, `applyPageRange`,
`applyCursorLimit`, `toPage`, plus the `*_QUERY_PARAM` constants.
