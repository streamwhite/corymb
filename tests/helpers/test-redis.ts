import { mkdirSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Managed Redis started for tests that need a real broker. */
export type ManagedTestRedis = {
  url: string;
  stop: () => Promise<void>;
};

const ENV_TEST_REDIS_URL = "TEST_REDIS_URL" as const;
const REDIS_READY_TIMEOUT_MS = 5000;
const REDIS_POLL_INTERVAL_MS = 50;

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(REDIS_POLL_INTERVAL_MS, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function freePort(): number {
  const server = Bun.serve({ port: 0, fetch: () => new Response("ok") });
  const port = server.port ?? 0;
  server.stop(true);
  return port;
}

async function waitForPort(port: number): Promise<void> {
  const deadline = Date.now() + REDIS_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return;
    await Bun.sleep(REDIS_POLL_INTERVAL_MS);
  }
  throw new Error(`Redis did not become ready on port ${String(port)}`);
}

let managed: ManagedTestRedis | null = null;
let starting: Promise<ManagedTestRedis> | null = null;

async function startRedis(): Promise<ManagedTestRedis> {
  const port = freePort();
  const dir = join(tmpdir(), `redis-test-${String(port)}`);
  mkdirSync(dir, { recursive: true });
  const proc = Bun.spawn(
    [
      "redis-server",
      "--port",
      String(port),
      "--save",
      "",
      "--appendonly",
      "no",
      "--dir",
      dir,
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  await waitForPort(port);
  return {
    url: `redis://127.0.0.1:${String(port)}`,
    stop: async () => {
      proc.kill();
      await proc.exited;
    },
  };
}

/** Returns the test Redis URL: `TEST_REDIS_URL` if set, else a managed instance. */
export async function getTestRedisUrl(): Promise<string> {
  const external = process.env[ENV_TEST_REDIS_URL];
  if (external !== undefined && external.length > 0) {
    return external;
  }
  starting ??= startRedis();
  managed = await starting;
  return managed.url;
}

export async function stopTestRedis(): Promise<void> {
  if (managed !== null) {
    await managed.stop();
    managed = null;
    starting = null;
  }
}

const REDIS_AVAILABLE = Bun.which("redis-server") !== null;

export { REDIS_AVAILABLE };
