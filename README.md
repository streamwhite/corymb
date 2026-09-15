# bun-backend-starter

Production-ready Bun backend as an installable package: authentication, persistence, caching, realtime, rate limiting, uploads and API docs — everything wired and tested.

## Features

- **Auth** — Better Auth (email/password, username, session rotation, bearer + JWT, passkeys/WebAuthn)
- **Databases** — SQLite (default, file or `:memory:`) or PostgreSQL via `DATABASE_URL`
- **Realtime** — authenticated SSE events (Redis pub/sub fan-out, in-memory fallback)
- **Caching** — Redis cache-aside for auth sessions/users (`createMemoryCache()` for local/tests)
- **Hardening** — security headers, request size caps, tiered in-memory rate limiting
- **Docs** — API docs page (`/docs`), auth UI page (`/ui`), uploads (`/upload`)

## Requirements

- [Bun](https://bun.sh) `>= 1.3.0`
- Redis (or Valkey) reachable at `REDIS_URL` unless you pass `cache: createMemoryCache()`

## 1. New project (recommended)

```sh
bunx bun-backend-starter init my-app
cd my-app
bun install
# edit .env — set BETTER_AUTH_SECRET (32+ chars); start Redis
bun run dev
```

Use `--force` to overwrite a non-empty directory.

The scaffold includes sample routes (`/api/hello`, `/api/widgets`) that show how to extend the server and publish SSE events.

## 2. Use as a library

```sh
bun add bun-backend-starter
```

```ts
import {
  createApp,
  createMemoryCache,
  publishRealtimeEvent,
  startServer,
  withRateLimit,
} from "bun-backend-starter";

const { server, app, url } = await startServer({
  // Optional: skip Redis for local experiments
  // cache: createMemoryCache(),
  routes: {
    "/api/hello": {
      GET: withRateLimit("relaxed", () =>
        Response.json({ message: "hello" }),
      ),
    },
  },
});

console.log(`listening on ${url.href}`);

// Publish to authenticated clients on GET /realtime/events
await publishRealtimeEvent(app.events, {
  type: "widget.created",
  data: { id: "1" },
  at: Date.now(),
});
```

Consumer `routes` are merged after built-ins; your path wins on conflict. Prefer `createApp()` when you want to own `Bun.serve` yourself:

```ts
const app = await createApp({ /* options */ });
Bun.serve({
  routes: app.routes,
  fetch: app.fetchNotFound,
  error: app.onServeError,
  port: 3000,
});
```

See [`.env.example`](.env.example) for environment variables.

## 3. Run the built-in server as-is

```sh
bun add bun-backend-starter
# configure .env (BETTER_AUTH_SECRET + REDIS_URL)
bunx bun-backend-starter
# or: bunx bun-backend-starter start
```

## Develop this repository

```sh
bun install
cp .env.example .env        # then fill in BETTER_AUTH_SECRET etc.
bun run dev:all             # starts local Redis (if installed) + the app with watch mode
bun test                    # unit/integration tests (SQLite in-memory)
bun run build               # bundles dist/ (library + CLI + types + migrations)
bun run start               # run the built server
```

## Publish

```sh
bun run build
bun publish                 # prepack runs build automatically
```

The package publishes `dist/` (bundled library + CLI + `.d.ts` types + SQL migrations), plus `README.md`, `LICENSE`, `.env.example`, and `docs/`.

## Docs

- [Database & Passkey configuration](docs/database.md)
- [Realtime SSE example usage](docs/realtime-sse.md)

## License

MIT
