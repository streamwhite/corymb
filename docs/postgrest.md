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

## Search: full-text, suggestions, semantic, hybrid

`migrate` installs `pg_trgm` (0003) and `unaccent` + a text search configuration
`app.unaccent_english` + `app.immutable_unaccent()` (0004). Accents normalize
(`réact` ~ `react`) for documents, queries, generated columns and indexes.
**pgvector is not a trusted extension** — install it as the superuser
(`create extension vector`) before using the semantic/hybrid functions.

### Full-text search (FTS)

Add a stored `tsvector` column (weighted) and a GIN index; rank with
`ts_rank`/`ts_rank_cd` and highlight with `ts_headline`:

```sql
alter table app.todos add column search tsvector generated always as (
  setweight(to_tsvector('app.unaccent_english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('app.unaccent_english', coalesce(body, '')), 'B')
) stored;
create index todos_search_gin on app.todos using gin (search);
```

PostgREST exposes the operators natively (no function needed):

```
GET /todos?search=wfts(app.unaccent_english).react   # websearch_to_tsquery
GET /todos?search=plfts(app.unaccent_english).react  # plainto_tsquery
GET /todos?search=fts(app.unaccent_english).react    # to_tsquery
GET /todos?search=phfts(app.unaccent_english).react  # phrase
```

Pass the same `app.unaccent_english` config so query parsing matches the stored
vector. Use an RPC when you need ranking or snippets:

```sql
create or replace function app.search(q text, max_rows int default 20)
returns table (id uuid, title text, rank_score real, headline text)
language sql stable
set search_path = app, public, pg_catalog
as $$
  select t.id, t.title,
         ts_rank_cd(t.search, websearch_to_tsquery('app.unaccent_english', q)) as rank_score,
         ts_headline('app.unaccent_english', coalesce(t.body, t.title),
                     websearch_to_tsquery('app.unaccent_english', q),
                     'StartSel=<mark>, StopSel=</mark>, MaxWords=20, MinWords=5') as headline
  from app.todos t
  where t.search @@ websearch_to_tsquery('app.unaccent_english', q)
  order by rank_score desc
  limit least(greatest(max_rows, 1), 100);
$$;
grant execute on function app.search(text, int) to authenticated;
```

### Suggestions (typo tolerance)

Trigram suggestions on an unaccented expression index (the immutable wrapper
makes the expression indexable):

```sql
create index todos_title_trgm on app.todos
  using gin (app.immutable_unaccent(title) gin_trgm_ops);

create or replace function app.search_suggest(q text, max_rows int default 10)
returns table (suggestion text, similarity real)
language sql stable
set search_path = app, public, pg_catalog
set pg_trgm.word_similarity_threshold = 0.4
as $$
  select t.title, word_similarity(app.immutable_unaccent(q), app.immutable_unaccent(t.title))
  from app.todos t
  where app.immutable_unaccent(q) <% app.immutable_unaccent(t.title)
  order by 2 desc
  limit least(greatest(max_rows, 1), 50);
$$;
```

### Semantic search (pgvector)

Store an embedding per row; the **application generates embeddings** and writes
them (the framework never calls a model). Query by cosine distance:

```sql
alter table app.todos add column embedding vector(1536);
create index todos_embedding_hnsw on app.todos using hnsw (embedding vector_cosine_ops);

create or replace function app.search_semantic(query_embedding text, max_rows int default 20)
returns table (id uuid, title text, distance real)
language sql stable
set search_path = app, public, pg_catalog
as $$
  select t.id, t.title, (t.embedding <=> query_embedding::vector) as distance
  from app.todos t
  where t.embedding is not null
  order by t.embedding <=> query_embedding::vector
  limit least(greatest(max_rows, 1), 100);
$$;
```

Take the embedding as `text` (e.g. `"[0.1,0.2,…]"`) and cast inside: PostgREST
sends JSON strings, and a `vector` argument would not resolve.

### Hybrid search (RRF)

Fuse the full-text and vector rankings with Reciprocal Rank Fusion (k = 60),
which needs no score normalization:

```sql
create or replace function app.search_hybrid(q text, query_embedding text, max_rows int default 20)
returns table (id uuid, title text, score real)
language sql stable
set search_path = app, public, pg_catalog
as $$
  with fts as (
    select t.id, row_number() over (
             order by ts_rank_cd(t.search, websearch_to_tsquery('app.unaccent_english', q)) desc) as rnk
    from app.todos t
    where t.search @@ websearch_to_tsquery('app.unaccent_english', q)
    limit 100
  ), vec as (
    select t.id, row_number() over (order by t.embedding <=> query_embedding::vector) as rnk
    from app.todos t
    where t.embedding is not null
    order by t.embedding <=> query_embedding::vector
    limit 100
  )
  select t.id, t.title, sum(1.0 / (60 + r.rnk))::real as score
  from (select id, rnk from fts union all select id, rnk from vec) r
  join app.todos t on t.id = r.id
  group by t.id, t.title
  order by score desc
  limit least(greatest(max_rows, 1), 100);
$$;
```

All functions are `security invoker`, so **RLS still applies**.

### Endpoints

PostgREST has no nested routes; expose the functions over `/rpc/*` and let the
reverse proxy present the public paths:

```nginx
location = /search          { rewrite ^ /rpc/search         break; proxy_pass http://127.0.0.1:3001; }
location = /search/suggest  { rewrite ^ /rpc/search_suggest break; proxy_pass http://127.0.0.1:3001; }
location = /search/semantic { rewrite ^ /rpc/search_semantic break; proxy_pass http://127.0.0.1:3001; }
location = /search/hybrid   { rewrite ^ /rpc/search_hybrid  break; proxy_pass http://127.0.0.1:3001; }
```

Clients then call `POST /search` `{"q":"react"}`, `POST /search/semantic`
`{"query_embedding":"[…]"}`, `POST /search/hybrid` `{"q":"react","query_embedding":"[…]"}`
(functions are `STABLE`, so `GET` with query params also works). Re-run
`notify pgrst, 'reload schema'` after changing them.

## Shared cluster (database-per-project)

When several projects share one PostgreSQL cluster, anaglyph provisions each
project's own database and a **project-scoped login role**, and revokes `PUBLIC`
`CONNECT` so no other project's role can reach it. PostgreSQL roles are
cluster-global, so the authenticator must be unique per project. Run this
bootstrap against the project's database with that role:

```sh
psql "$DATABASE_URL" \
  -v authenticator=<project>_app_authenticator \
  -v authenticator_password='<pw>' \
  -f postgrest/bootstrap.sql
```

The script is idempotent and leaves existing roles unchanged, so it is safe to
re-run. `anon` / `authenticated` / `service_role` stay shared cluster-wide; they
are only reachable through the project role's connection.

## Security notes

- Never expose `DATABASE_URL` or `POSTGREST_SERVICE_TOKEN` to clients.
- RLS is not input validation; validate request bodies in your routes too.
- Re-run `jwks` after key rotation, then reload PostgREST
  (`NOTIFY pgrst, 'reload config'` or restart).
- `/ready` reports `postgrest: false` when the data API is unreachable.
