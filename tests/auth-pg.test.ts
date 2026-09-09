import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { VALID_TEST_USERNAME } from "./constants.js";
import { signupUser } from "./helpers/auth-flow.js";
import { createMemoryApp } from "./helpers/app-memory.js";

const PG_BIN_DIR = "/usr/lib/postgresql/16/bin";
const PG_AVAILABLE =
  existsSync(join(PG_BIN_DIR, "initdb")) &&
  existsSync(join(PG_BIN_DIR, "pg_ctl"));

const PG_TEST_PORT = 54399;
const PG_TEST_DB = "bun_auth_bunsql_test";

/** Grab a free TCP port so parallel/stray servers never collide. */
async function freePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch: () => new Response("ok") });
  const port = server.port;
  server.stop(true);
  return port;
}

async function run(
  cmd: string[],
  env?: Record<string, string>,
): Promise<void> {
  const proc = Bun.spawn(cmd, {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`${cmd.join(" ")} failed (${String(code)}): ${err}`);
  }
}

describe.skipIf(!PG_AVAILABLE)("auth on PostgreSQL via pg pool", () => {
  it(
    "signs up and reads the session via Better Auth",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "pg-bun-sql-"));
      const dataDir = join(dir, "pgdata");
      const port = await freePort();
      const url = `postgres://postgres@127.0.0.1:${String(port)}/${PG_TEST_DB}`;
      try {
        await run([join(PG_BIN_DIR, "initdb"), "-D", dataDir, "--auth=trust", "-U", "postgres"]);
        await run([
          join(PG_BIN_DIR, "pg_ctl"),
          "-D", dataDir,
          "-o", `-p ${String(port)} -k ${dir} -h 127.0.0.1`,
          "-w", "-t", "30",
          "start",
        ]);
        await run([
          join(PG_BIN_DIR, "psql"),
          "-h", "127.0.0.1", "-p", String(port), "-U", "postgres",
          "-c", `CREATE DATABASE ${PG_TEST_DB}`,
        ]);

        const { app } = await createMemoryApp({
          databaseConfig: { dialect: "postgres", pgUrl: url },
        });
        const signup = await signupUser(app.request, {
          email: "bun-sql-pg@example.com",
          username: VALID_TEST_USERNAME,
          password: "x".repeat(16),
        });
        expect(signup.status).toBe(200);

        const session = await app.requestWithCookies(
          "/api/auth/get-session",
          undefined,
          { value: signup.cookies },
        );
        expect(session.status).toBe(200);
        const body = (await session.json()) as { user?: { email?: string } };
        expect(body.user?.email).toBe("bun-sql-pg@example.com");
      } finally {
        await run([
          join(PG_BIN_DIR, "pg_ctl"),
          "-D", dataDir,
          "-m", "immediate",
          "stop",
        ]).catch(() => {});
        rmSync(dir, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
