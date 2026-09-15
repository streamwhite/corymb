import { mkdirSync, readdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";

export const PACKAGE_NAME = "bun-backend-starter" as const;
export const CLI_INIT_COMMAND = "init" as const;
export const CLI_START_COMMAND = "start" as const;
export const CLI_FORCE_FLAG = "--force" as const;

const ENV_EXAMPLE = `# Copy to \`.env\` in the project root. Bun loads \`.env\` automatically.

# Required for Better Auth (at least 32 characters). JWT_SECRET is accepted as fallback.
BETTER_AUTH_SECRET=replace-with-a-long-random-secret-at-least-32-characters

# Public base URL used by Better Auth (emails, redirects).
# Must match how you open the app in the browser (scheme + host + port).
# With local TLS: https://localhost:3000  (prefer localhost over 0.0.0.0)
BETTER_AUTH_URL=http://localhost:3000

# HTTP listen port (default 3000).
PORT=3000

# HTTP listen host. Defaults: localhost in development, 0.0.0.0 in production.
# HOST=localhost

# Redis (required at app startup for secondary storage / cache).
# VALKEY_URL is accepted as an alias when REDIS_URL is unset.
REDIS_URL=redis://127.0.0.1:6379
# VALKEY_URL=redis://127.0.0.1:6379
# CACHE_KEY_PREFIX=ba:
# CACHE_USER_TTL_SECONDS=300
# CACHE_SESSION_TTL_SECONDS=300

# SQLite database file (default data/items.sqlite). Ignored when DATABASE_URL is set.
# SQLITE_PATH=data/items.sqlite

# PostgreSQL — when set, the app uses Postgres instead of SQLite.
# DATABASE_URL=postgres://user:pass@127.0.0.1:5432/mydb

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

# Mail (default driver: console)
# MAILER_DRIVER=console
# MAILER_DRIVER=noop
# MAIL_FROM=no-reply@example.com
# APP_PUBLIC_BASE_URL=http://localhost:3000

# Rate limits (max requests per client per 60s window)
# RATE_LIMIT_STRICT_MAX=10
# RATE_LIMIT_STANDARD_MAX=60
# RATE_LIMIT_RELAXED_MAX=300

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

const INDEX_TS = `import {
  publishRealtimeEvent,
  startServer,
  withRateLimit,
  type AppInstance,
} from "${PACKAGE_NAME}";

/** Filled after boot so route handlers can publish SSE without TDZ issues. */
const ctx: { app?: AppInstance } = {};

const { server, app, url } = await startServer({
  routes: {
    "/api/hello": {
      GET: withRateLimit("relaxed", () =>
        Response.json({ message: "hello from your app" }),
      ),
    },
    "/api/widgets": {
      POST: withRateLimit("standard", async (req) => {
        const body = (await req.json().catch(() => ({}))) as {
          name?: string;
        };
        const widget = {
          id: crypto.randomUUID(),
          name: body.name ?? "untitled",
        };
        // Broadcast to authenticated SSE clients on /realtime/events
        if (ctx.app !== undefined) {
          await publishRealtimeEvent(ctx.app.events, {
            type: "widget.created",
            data: widget,
            at: Date.now(),
          });
        }
        return Response.json(widget, { status: 201 });
      }),
    },
  },
});
ctx.app = app;

console.info(\`listening on \${url.href}\`);
console.info("built-ins: /health /docs /ui /api/auth /upload /realtime/events");

process.once("SIGINT", () => {
  void server.stop().then(() => app.close()).then(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void server.stop().then(() => app.close()).then(() => process.exit(0));
});
`;

const README = `# My Bun backend

Scaffolded with \`${PACKAGE_NAME}\`.

## Setup

\`\`\`sh
bun install
# edit .env — set BETTER_AUTH_SECRET (32+ chars) and ensure Redis is running
bun run dev
\`\`\`

Redis is required by default for cache/session secondary storage. For local tests without Redis, pass \`cache: createMemoryCache()\` to \`startServer\`.

## Built-in routes

- \`GET /health\`
- \`GET /docs\` — API docs
- \`GET /ui\` — auth UI
- \`/api/auth/*\` — Better Auth
- \`POST /upload\`
- \`GET /realtime/events\` — authenticated SSE

Custom routes live in \`src/index.ts\` via the \`routes\` option (your paths win on conflict).

## Docs

See the package README and \`docs/\` after \`bun add ${PACKAGE_NAME}\` (or on the published package page).
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
    { relative: ".env", contents: ENV_EXAMPLE },
    { relative: ".env.example", contents: ENV_EXAMPLE },
    { relative: "src/index.ts", contents: INDEX_TS },
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
