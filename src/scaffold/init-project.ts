import { mkdirSync, readdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";

export const PACKAGE_NAME = "corymb" as const;
export const CLI_INIT_COMMAND = "init" as const;
export const CLI_START_COMMAND = "start" as const;
export const CLI_MIGRATE_COMMAND = "migrate" as const;
export const CLI_MIGRATE_STATUS_COMMAND = "migrate:status" as const;
export const CLI_SEED_COMMAND = "seed" as const;
export const CLI_JWKS_COMMAND = "jwks" as const;
export const CLI_FORCE_FLAG = "--force" as const;
export const DEFAULT_JWKS_OUTPUT = "postgrest/jwks.json" as const;

const ENV_EXAMPLE = `# Copy to \`.env\` in the project root. Bun loads \`.env\` automatically.

# Required for Better Auth (at least 32 characters). JWT_SECRET is accepted as fallback.
BETTER_AUTH_SECRET=replace-with-a-long-random-secret-at-least-32-characters

# Public base URL used by Better Auth (emails, redirects).
# Must match how you open the app in the browser (scheme + host + port).
BETTER_AUTH_URL=http://localhost:3000

# HTTP listen port (default 3000).
PORT=3000

# HTTP listen host. Defaults: localhost in development, 0.0.0.0 in production.
# HOST=localhost
# SERVICE_NAME=my-backend
# LOG_LEVEL=info

# PostgreSQL admin connection (auth schema + migrations + seed).
# Application data is NOT read through this connection; it goes through PostgREST.
DATABASE_URL=postgres://user:pass@127.0.0.1:5432/mydb

# PostgREST data API (application schema, RLS enforced).
POSTGREST_URL=http://127.0.0.1:3001
# POSTGREST_SCHEMA=app
# Optional privileged token for server-side/admin requests (keep secret).
# POSTGREST_SERVICE_TOKEN=
# POSTGREST_TIMEOUT_MS=10000

# CORS allowlist for browser clients (comma separated). Empty disables CORS.
# CORS_ORIGINS=https://app.example.com
# CORS_CREDENTIALS=true

# Redis (required at app startup for secondary storage / cache).
# VALKEY_URL is accepted as an alias when REDIS_URL is unset.
REDIS_URL=redis://127.0.0.1:6379
# VALKEY_URL=redis://127.0.0.1:6379
# CACHE_KEY_PREFIX=ba:
# CACHE_USER_TTL_SECONDS=300
# CACHE_SESSION_TTL_SECONDS=300

# Upload directory (default data/uploads).
# UPLOAD_DIR=data/uploads

# Passkey (WebAuthn). Defaults derive from BETTER_AUTH_URL (rpID=hostname, origin=scheme://host[:port]).
# Override only if the browser origin differs from BETTER_AUTH_URL. Production must be HTTPS.
# BETTER_AUTH_PASSKEY_RP_ID=localhost
# BETTER_AUTH_PASSKEY_ORIGIN=http://localhost:3000
# MAX_PASSKEYS_PER_USER=5

# Optional session / JWT tuning
# ACCESS_JWT_EXPIRATION=15m
# SESSION_EXPIRES_IN_SECONDS=604800
# SESSION_UPDATE_AGE_SECONDS=86400
# COOKIE_CACHE_MAX_AGE_SECONDS=300

# Sensitive-operation step-up (re-authentication)
# SESSION_FRESH_AGE_SECONDS=3600   # sessions older than this need re-auth for sensitive ops
# SENSITIVE_VERIFY_TTL_SECONDS=300 # how long an explicit password re-check stays valid

# Mail (default driver: console)
# MAILER_DRIVER=console
# MAILER_DRIVER=noop
# MAIL_FROM=no-reply@example.com
# APP_PUBLIC_BASE_URL=http://localhost:3000

# Rate limits (max requests per client per 60s window)
# RATE_LIMIT_STRICT_MAX=10
# RATE_LIMIT_STANDARD_MAX=60
# RATE_LIMIT_RELAXED_MAX=300

# Bot detection (User-Agent based)
# BOT_DETECTION_MODE=block        # block (default) | log | off
# BOT_BLOCK_EXTRA=                # extra blocked tokens, comma/space separated
# BOT_ALLOW_EXTRA=                # tokens to always allow (overrides block list)

# Dev TLS (only when NODE_ENV=development and both paths exist)
# TLS_CERT_PATH=./certs/localhost.pem
# TLS_KEY_PATH=./certs/localhost-key.pem

# Optional override for SQL migrations folder
# MIGRATIONS_FOLDER=

# Password hashing cost (bcrypt)
# BCRYPT_COST=12
`;

function packageJsonFor(projectName: string): string {
  return `${JSON.stringify(
    {
      name: projectName,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        dev: "bun --watch src/index.ts",
        start: "NODE_ENV=production bun src/index.ts",
        "db:migrate": "bunx corymb migrate",
        "db:migrate:status": "bunx corymb migrate:status",
        "db:seed": "bunx corymb seed",
        "jwks:export": "bunx corymb jwks",
      },
      dependencies: {
        [PACKAGE_NAME]: "^1.0.0",
      },
      devDependencies: {
        "@types/bun": "^1.3.13",
      },
    },
    null,
    2,
  )}\n`;
}

const INDEX_TS = `import { join } from "path";
import {
  AUDIT_ACTIONS,
  UnauthorizedError,
  ValidationError,
  bearerToken,
  createFileAuditSink,
  createGracefulShutdown,
  createSseResponse,
  publishRealtimeEvent,
  startServer,
  withRateLimit,
  withValidation,
  type AppInstance,
  type Middleware,
  type MiddlewareContext,
  type WebSocketConnection,
} from "${PACKAGE_NAME}";

/** Filled after boot so route handlers can reach the data client/events. */
const ctx: { app?: AppInstance } = {};

function requireToken(req: Request): string {
  const token = bearerToken(req);
  if (token === undefined) {
    throw new UnauthorizedError("Bearer token required");
  }
  return token;
}

/** Custom middleware: attach a tenant id read from a header. */
const withTenant: Middleware = (c: MiddlewareContext, next) => {
  c.state.tenant = c.req.headers.get("X-Tenant-Id") ?? "public";
  return next();
};

const parseTodo = (input: unknown): Record<string, unknown> => {
  const body = typeof input === "object" && input !== null ? input : {};
  const title = (body as { title?: unknown }).title;
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new ValidationError("title is required", { field: "title" });
  }
  return { ...body, title: title.trim() };
};

const { server, app, url } = await startServer({
  // Durable audit trail alongside the built-in structured log sink.
  auditSinks: [createFileAuditSink(join("data", "audit.jsonl"))],
  // Record audit events for these paths automatically.
  auditRules: [{ path: "/api/todos", action: AUDIT_ACTIONS.dataCreated, targetType: "todo" }],
  // Require an Idempotency-Key on retry-prone mutations.
  idempotencyPaths: ["/api/todos"],
  // BullMQ queue backed by REDIS_URL; retries + dead-letter are built in.
  taskQueue: { concurrency: 4, maxAttempts: 3 },
  // Global middleware runs on every route (gzip/brotli compression is on by default).
  middleware: [withTenant],
  // Object storage: filesystem by default; set STORAGE_DRIVER=s3 for S3.
  routes: {
    "/api/health": {
      GET: withRateLimit("relaxed", () => Response.json({ ok: true })),
    },
    // Validates and normalizes the JSON body before the handler runs.
    "/api/echo": {
      POST: withValidation(parseTodo, {}),
    },
    // Server-sent events stream (no buffering; works with the SSE helper).
    "/api/time": {
      GET: () =>
        createSseResponse((stream) => {
          stream.send({ data: new Date().toISOString() });
          stream.close();
        }),
    },
    // Reads run through PostgREST, scoped to the caller's Better Auth JWT so
    // database RLS applies. Configure POSTGREST_URL and the app's RLS policies.
    "/api/todos": {
      GET: withRateLimit("relaxed", async (req) => {
        const token = requireToken(req);
        const result = await ctx.app!.data!.withToken(token).from("todos").select("*");
        return Response.json(result.data);
      }),
      POST: withRateLimit("standard", async (req) => {
        const token = requireToken(req);
        const input = parseTodo(await req.json().catch(() => ({})));
        const result = await ctx.app!.data!.withToken(token).from("todos").insert(input).select();

        await ctx.app!.audit({ action: AUDIT_ACTIONS.dataCreated, target: { type: "todo" } });
        await publishRealtimeEvent(ctx.app!.events, {
          type: "todo.created",
          data: result.data,
          at: Date.now(),
        });
        // Durable background work on Redis (retries, dead-letter).
        await ctx.app!.tasks.run("notify", async () => {
          ctx.app!.logger.info("notify dispatched", { data: result.data });
        });
        return Response.json(result.data, { status: 201 });
      }),
    },
  },
  // WebSocket endpoint with an optional authorize hook.
  websocket: [
    {
      path: "/ws/echo",
      open(ws: WebSocketConnection) {
        ws.subscribe("room");
        ws.send(JSON.stringify({ type: "ready" }));
      },
      message(ws: WebSocketConnection, message: string | Buffer) {
        const text = typeof message === "string" ? message : message.toString();
        ws.publish("room", text);
      },
    },
  ],
});
ctx.app = app;

app.logger.info("listening", { url: url.href });

createGracefulShutdown({
  logger: app.logger,
  steps: [
    { name: "http-server", run: () => server.stop() },
    { name: "app", run: () => app.close() },
  ],
}).installSignalHandlers();
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "types": ["bun"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts"]
}
`;

const GITIGNORE = `node_modules/
dist/
coverage/
.env
*.log
/data/
/postgrest/jwks.json
`;

const POSTGREST_CONF = `# PostgREST local config. Generate jwks.json with:
#   bunx ${PACKAGE_NAME} jwks postgrest/jwks.json
db-uri = "postgres://app_authenticator:CHANGE_ME@127.0.0.1:5432/mydb"
db-schemas = "app"
db-anon-role = "anon"
jwt-secret = "@./jwks.json"
jwt-role-claim-key = ".role"
server-port = 3001
`;

const README = `# My Bun backend

Scaffolded with \`${PACKAGE_NAME}\`. Auth persists to PostgreSQL; application
data is served by PostgREST with row-level security.

## Setup

\`\`\`sh
bun install
# edit .env — set BETTER_AUTH_SECRET, DATABASE_URL, POSTGREST_URL and ensure Redis is running
bun run db:migrate          # creates the auth + app schemas
bunx corymb jwks   # writes postgrest/jwks.json for PostgREST
bun run dev
\`\`\`

See the package docs for the required PostgREST config, database roles and RLS
policies (\`docs/postgrest.md\`).

## Built-in routes

- \`GET /health\` — liveness
- \`GET /ready\` — readiness (cache + PostgREST)
- \`GET /docs\` — API docs
- \`GET /ui\` — auth UI
- \`/api/auth/*\` — Better Auth
- \`POST /upload\`
- \`GET /realtime/events\` — authenticated SSE

Custom routes live in \`src/index.ts\` via the \`routes\` option (your paths win on conflict).

## Framework features used here

- **Config** — \`loadAppConfig()\` validates every env var and lists all issues at once.
- **Errors** — throw \`ValidationError\`/\`UnauthorizedError\`; the framework maps them to a
  unified JSON body and hides 5xx internals.
- **Logging** — \`app.logger\` emits redacted JSON lines (consola under the hood).
- **Audit** — \`app.audit({ action })\` fans out to the log sink and \`auditSinks\`.
- **Tasks** — \`app.tasks.run(name, handler)\` runs retried background work; drained on shutdown.
- **2FA** — Better Auth two-factor email OTP is enabled (\`/api/auth/two-factor/*\`).
- **Transactions** — use a database function via \`runInTransaction\`, or \`createUnitOfWork\`
  for privileged atomic multi-step operations.

## PostgREST

\`postgrest/postgrest.conf\` is a starting config. Create the database roles and RLS
policies from the package's \`postgrest/bootstrap.sql\`.
`;

export type InitProjectOptions = {
  targetDir: string;
  force?: boolean;
  packageVersion?: string;
};

export type InitProjectResult = {
  targetDir: string;
  filesWritten: string[];
};

function isDirectoryEmpty(dir: string): boolean {
  try {
    return readdirSync(dir).length === 0;
  } catch {
    return true;
  }
}

function projectNameFromDir(dir: string): string {
  const base = dir.split(/[/\\]/).filter(Boolean).at(-1) ?? "my-app";
  return base.replace(/[^a-zA-Z0-9._-]/g, "-") || "my-app";
}

export function initProject(options: InitProjectOptions): InitProjectResult {
  const targetDir = resolve(options.targetDir);
  const force = options.force === true;

  if (!isDirectoryEmpty(targetDir) && !force) {
    throw new Error(
      `Refusing to write into non-empty directory: ${targetDir} (pass ${CLI_FORCE_FLAG} to overwrite)`,
    );
  }

  mkdirSync(join(targetDir, "src"), { recursive: true });
  mkdirSync(join(targetDir, "postgrest"), { recursive: true });

  const name = projectNameFromDir(targetDir);
  let packageJson = packageJsonFor(name);
  if (options.packageVersion !== undefined) {
    packageJson = packageJson.replace(
      `"${PACKAGE_NAME}": "^1.0.0"`,
      `"${PACKAGE_NAME}": ${JSON.stringify(options.packageVersion)}`,
    );
  }

  const files: Array<{ relative: string; contents: string }> = [
    { relative: "package.json", contents: packageJson },
    { relative: "tsconfig.json", contents: TSCONFIG },
    { relative: ".gitignore", contents: GITIGNORE },
    { relative: ".env", contents: ENV_EXAMPLE },
    { relative: ".env.example", contents: ENV_EXAMPLE },
    { relative: "src/index.ts", contents: INDEX_TS },
    { relative: "postgrest/postgrest.conf", contents: POSTGREST_CONF },
    { relative: "README.md", contents: README },
  ];

  const filesWritten: string[] = [];
  for (const file of files) {
    const abs = join(targetDir, file.relative);
    writeFileSync(abs, file.contents, "utf8");
    filesWritten.push(file.relative);
  }

  return { targetDir, filesWritten };
}
