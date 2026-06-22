import { RedisClient } from "bun";
import { parseRedisEndpoint, type RedisEndpoint } from "./parse-redis-endpoint.js";

const PING_RETRY_MS = 200 as const;
const PING_MAX_ATTEMPTS = 50 as const;
const REDIS_SERVER_BIN = "redis-server" as const;
const REDIS_BIND_HOST = "127.0.0.1" as const;

export type ManagedRedis = {
  child: Bun.Subprocess | null;
};

export async function pingRedis(redisUrl: string): Promise<boolean> {
  const client = new RedisClient(redisUrl, { connectionTimeout: 2000 });
  try {
    const reply = await client.send("PING", []);
    return reply === "PONG";
  } catch {
    return false;
  } finally {
    client.close();
  }
}

async function waitForRedis(redisUrl: string): Promise<boolean> {
  for (let attempt = 0; attempt < PING_MAX_ATTEMPTS; attempt += 1) {
    if (await pingRedis(redisUrl)) {
      return true;
    }
    await Bun.sleep(PING_RETRY_MS);
  }
  return false;
}

async function findExecutable(name: string): Promise<string | undefined> {
  const proc = Bun.spawn(["sh", "-c", `command -v ${name}`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  if (proc.exitCode !== 0) {
    return undefined;
  }
  const trimmed = stdout.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function spawnLocalRedis(endpoint: RedisEndpoint, bin: string): Bun.Subprocess {
  return Bun.spawn({
    cmd: [
      bin,
      "--port",
      String(endpoint.port),
      "--bind",
      REDIS_BIND_HOST,
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
}

function remoteRedisMessage(endpoint: RedisEndpoint): string {
  return (
    `Redis is not reachable at ${endpoint.host}:${String(endpoint.port)}. ` +
    "Start Redis on that host or set REDIS_URL to a local instance."
  );
}

function missingBinaryMessage(): string {
  return (
    "Redis is not running and redis-server was not found on PATH. " +
    "Install Redis or start it manually, then rerun."
  );
}

export async function ensureRedisReady(redisUrl: string): Promise<ManagedRedis> {
  if (await pingRedis(redisUrl)) {
    return { child: null };
  }

  const endpoint = parseRedisEndpoint(redisUrl);
  if (!endpoint.isLocal) {
    throw new Error(remoteRedisMessage(endpoint));
  }

  const bin = await findExecutable(REDIS_SERVER_BIN);
  if (bin === undefined) {
    throw new Error(missingBinaryMessage());
  }

  const child = spawnLocalRedis(endpoint, bin);
  const ready = await waitForRedis(redisUrl);
  if (!ready) {
    child.kill();
    throw new Error("Timed out waiting for redis-server to accept connections.");
  }

  console.info(`Redis ready (${redisUrl})`);
  return { child };
}

export async function stopManagedRedis(managed: ManagedRedis): Promise<void> {
  const child = managed.child;
  if (child === null) {
    return;
  }
  child.kill();
  await child.exited;
}
