# Hono server + items CRUD

## Workflow

```mermaid
flowchart LR
  A[index.ts] --> B[createApp]
  B --> C[health route]
  B --> U[ui route]
  B --> D[auth routes]
  B --> E[items routes]
  E --> F[item-store]
  F --> G[Drizzle ORM]
  G --> H[(SQLite)]
  I[bun db:seed] --> H
  J[bun db:studio] --> H
```

## Test runner speed

```mermaid
flowchart LR
  P[tests/preload.ts] --> E["ENV_BCRYPT_COST=4"]
  E --> A[src/constants/auth.ts]
  A --> B[bcrypt hash/sign in routes + seed]
  C[bunfig.toml root=tests] --> D[bun test --concurrent]
```

- **Lower bcrypt cost in tests only** via `tests/preload.ts` + `BCRYPT_COST_TEST` (`src/constants/bcrypt-cost.ts`). Production/runtime defaults stay at **12** when `BCRYPT_COST` is unset.
- **`bun test --concurrent`** (see `package.json`) runs independent `it()` blocks concurrently; **`bunfig.toml`** limits discovery to `tests/` and applies the preload.

## Notes

- Runtime & tooling: **[Bun](https://bun.sh)** (`packageManager` / `bun.lock`). Scripts: `bun install`, `bun run …`. Tests: **`bun test`** (`bun:test`), config in **`bunfig.toml`**.
- Lint/format: [Biome](https://biomejs.dev) — `bun run lint` → `biome check .` (config: `biome.json`).
- Build: `bun run build` — emits `dist/` (`tsconfig.build.json`), rewrites `@/` via `tsc-alias`, copies SQL migrations into `dist/db/migrations`. Run `bun run start:dist` after build.
- Dev: `bun run dev` (`bun --watch src/index.ts`). `bun run start` runs sources directly.
- Entry: `src/index.ts` uses **`Bun.serve`** (`fetch: app.fetch`, port/hostname from env/constants); graceful shutdown via **`await server.stop()`** on `SIGINT`/`SIGTERM`.
- Health: `GET /health` → `{ "status": "ok" }`.
- Auth UI: `GET /ui` — HTML forms + fetch with `credentials: same-origin`.
- Auth API: `POST /auth/signup`, `/auth/signin`, `/auth/signout` — bcrypt + SQLite sessions.
- CRUD: `GET/POST /items`, `GET/PUT/DELETE /items/:id`.
- DB: [Drizzle ORM](https://orm.drizzle.team) + **`bun:sqlite`** (`drizzle-orm/bun-sqlite`); migrations in `src/db/migrations/`; `bun run db:generate` via drizzle-kit.
- Drizzle Studio: `bun run db:studio` — GUI at default `http://localhost:4983`. Matches `SQLITE_PATH` / default file (`drizzle.config.ts`); `:memory:` falls back for CLI with a warning.
- Default DB file `data/items.sqlite`. Tests use `:memory:` via `tests/helpers/app-memory.ts`.
- Seed: `bun run db:seed` — faker data; password `seed-password` (`src/constants/seed.ts`).
