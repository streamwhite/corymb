# PostgREST data layer

Application data is served by [PostgREST](https://postgrest.org). The framework
verifies requests with Better Auth-issued JWTs and enforces access with
PostgreSQL row-level security (RLS). See
[ADR 0001](adr/0001-postgrest-auth-exception.md) for why authentication is the
one direct-database exception.

## How the pieces fit

```
Client ──► Better Auth (/api/auth/*) ──► PostgreSQL auth.*   (DATABASE_URL)
Client ──► PostgREST                 ──► verify JWT (JWKS) ──► SET ROLE ──► RLS on app.*
Server route (optional) ──► app.data.withToken(userJwt).from("todos")...
```

## Setup

1. **Migrate** the auth/app schemas (creates `auth`, `app`, `auth.uid()`):

   ```sh
   bunx corymb migrate     # or: bun run db:migrate
   ```

2. **Export the JWKS** used by PostgREST (also creates the signing key pair on
   first run):

   ```sh
   bunx corymb jwks        # writes postgrest/jwks.json
   ```

3. **Bootstrap roles and grants** as a privileged database role. Edit
   [`postgrest/bootstrap.sql`](../postgrest/bootstrap.sql) (set passwords) and run
   it against your database.

4. **Start PostgREST** from [`postgrest/postgrest.conf.example`](../postgrest/postgrest.conf.example)
   and set `POSTGREST_URL` in the app's `.env`.

## Environment

| Variable | Purpose |
| --- | --- |
| `POSTGREST_URL` | Base URL of the PostgREST instance (required to enable `app.data`) |
| `POSTGREST_SCHEMA` | Schema/profile to target (default `app`) |
| `POSTGREST_SERVICE_TOKEN` | Optional pre-issued JWT for privileged server-side calls |
| `POSTGREST_TIMEOUT_MS` | Per-request timeout (default `10000`) |

## Server-side usage

```ts
const { data } = await app.data!
  .withToken(userJwt)          // forward the caller's Better Auth JWT (RLS applies)
  .from("todos")
  .select("id,title,done")
  .eq("done", false)
  .order("created_at", { ascending: false });

// Privileged/admin work (keep POSTGREST_SERVICE_TOKEN secret):
await app.data!.from("audit_log").insert({ actor, action });
```

Use PostgreSQL RPC functions for multi-statement/atomic work:

```ts
await app.data!.withToken(userJwt).rpc("complete_todo", { todo_id: id });
```

## Client-side usage (browser/mobile)

```ts
const jwt = (await fetch("/api/auth/token", { credentials: "include" }).then((r) => r.json())).token;

const res = await fetch(`${POSTGREST_URL}/todos?select=*`, {
  headers: { Authorization: `Bearer ${jwt}` },
});
```

## RLS example

```sql
create table app.todos (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table app.todos enable row level security;

create policy "owners read their todos" on app.todos
  for select to authenticated
  using (owner_id = auth.uid());

create policy "owners write their todos" on app.todos
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

## Fuzzy / similarity search (typo tolerance)

`migrate` installs the `pg_trgm` extension. PostgREST's native filters
(`like`/`ilike`/`fts`) cannot rank by similarity, so typo-tolerant search is a
SQL function (RPC) that you expose on your own table. Add a trigram index for
speed, then the function, grant, and a schema-cache reload:

```sql
-- 1. Trigram index: accelerates `%`, `<%` and ILIKE at scale.
create index todos_title_trgm_idx on app.todos using gin (title gin_trgm_ops);

-- 2. Ranked, typo-tolerant search. `word_similarity` matches the query against
--    the best substring, so a typo in a long title still matches (plain
--    `similarity` only works well for short strings). security invoker (default)
--    keeps RLS in force.
create or replace function app.search_todos(q text, max_rows int default 20)
returns setof app.todos language sql stable
set pg_trgm.word_similarity_threshold = 0.4
as $$
  select *
  from app.todos
  where q <% title or title ilike '%' || q || '%'
  order by word_similarity(q, title) desc, title
  limit least(greatest(max_rows, 1), 100);
$$;

-- 3. Let authenticated callers execute it, then reload PostgREST's schema cache.
grant execute on function app.search_todos(text, int) to authenticated;
notify pgrst, 'reload schema';
```

Adjust the `where`/`order by` columns per table. Tune the threshold (0.3–0.6) to
trade recall against noise; use plain `similarity(a, b)` + `%` only for short
values such as names.

Call it through the typed client (RLS applies to the caller's JWT):

```ts
const { data } = await app.data!
  .withToken(userJwt)
  .rpc("search_todos", { q: "reactt", max_rows: 10 });
```

## Security notes

- Never expose `DATABASE_URL` or `POSTGREST_SERVICE_TOKEN` to clients.
- RLS is not input validation; validate request bodies in your routes too.
- Re-run `jwks` after key rotation, then reload PostgREST
  (`NOTIFY pgrst, 'reload config'` or restart).
- `/ready` reports `postgrest: false` when the data API is unreachable.
