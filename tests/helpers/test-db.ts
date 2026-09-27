import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "pg";
import { migrateDatabase } from "@/db/migrate.js";

const PG_BIN_DIR =
  process.env.PG_BIN_DIR ?? "/usr/lib/postgresql/16/bin";

const ENV_TEST_DATABASE_URL = "TEST_DATABASE_URL" as const;

const MAINTENANCE_DATABASE = "postgres" as const;

const DB_PREFIX = "framework_test_" as const;

function pgBin(name: string): string {
  return join(PG_BIN_DIR, name);
}

export const PG_AVAILABLE: boolean =
  existsSync(pgBin("initdb")) &&
  existsSync(pgBin("pg_ctl")) &&
  existsSync(pgBin("psql"));

type TestServer = {
  maintenanceUrl: string;
  stop: () => Promise<void>;
};

let serverPromise: Promise<TestServer> | null = null;

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

async function freePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch: () => new Response("ok") });
  const port = server.port ?? 0;
  server.stop(true);
  return port;
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function withAdminClient<T>(
  url: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function startCluster(): Promise<TestServer> {
  const dir = mkdtempSync(join(tmpdir(), "pg-test-"));
  const dataDir = join(dir, "pgdata");
  const port = await freePort();
  await run([pgBin("initdb"), "-D", dataDir, "--auth=trust", "-U", "postgres"]);
  await run([
    pgBin("pg_ctl"),
    "-D",
    dataDir,
    "-o",
    `-p ${String(port)} -k ${dir} -h 127.0.0.1`,
    "-w",
    "-t",
    "30",
    "start",
  ]);
  return {
    maintenanceUrl: `postgres://postgres@127.0.0.1:${String(port)}/${MAINTENANCE_DATABASE}`,
    stop: async () => {
      await run([pgBin("pg_ctl"), "-D", dataDir, "-m", "immediate", "stop"]).catch(
        () => {},
      );
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function externalServer(url: string): TestServer {
  return {
    maintenanceUrl: withDatabase(url, MAINTENANCE_DATABASE),
    stop: async () => {},
  };
}

export async function getTestServer(): Promise<TestServer> {
  const external = process.env[ENV_TEST_DATABASE_URL];
  if (external !== undefined && external.length > 0) {
    return externalServer(external);
  }
  serverPromise ??= startCluster();
  return serverPromise;
}

/** Creates a fresh migrated database and returns its connection URL. */
export async function createTestDatabase(): Promise<string> {
  const server = await getTestServer();
  const name = `${DB_PREFIX}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  await withAdminClient(server.maintenanceUrl, (client) =>
    client.query(`CREATE DATABASE "${name}"`),
  );
  const url = withDatabase(server.maintenanceUrl, name);
  await migrateDatabase({ databaseConfig: { pgUrl: url } });
  return url;
}

export async function dropTestDatabase(pgUrl: string): Promise<void> {
  const server = await getTestServer();
  const name = new URL(pgUrl).pathname.replace(/^\//, "");
  if (!name.startsWith(DB_PREFIX)) {
    return;
  }
  await withAdminClient(server.maintenanceUrl, (client) =>
    client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
  );
}

/** Runs a one-off query against `pgUrl` (test assertions on raw tables). */
export async function queryPg<T = Record<string, unknown>>(
  pgUrl: string,
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  return withAdminClient(pgUrl, async (client) => {
    const result = await client.query(text, values);
    return result.rows as T[];
  });
}

export async function stopTestServer(): Promise<void> {
  if (serverPromise === null) {
    return;
  }
  const server = await serverPromise;
  serverPromise = null;
  await server.stop();
}
