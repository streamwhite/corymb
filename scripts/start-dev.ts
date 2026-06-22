import {
  ensureRedisReady,
  stopManagedRedis,
  type ManagedRedis,
} from "./lib/ensure-redis.js";
import { resolveRedisUrlFromEnv } from "@/constants/redis.js";

const NODE_ENV_DEVELOPMENT = "development" as const;
const APP_ENTRY = "src/index.ts" as const;
const SIGNAL_SIGINT = "SIGINT" as const;
const SIGNAL_SIGTERM = "SIGTERM" as const;

let isShuttingDown = false;

async function shutdown(
  app: Bun.Subprocess,
  redis: ManagedRedis,
): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  app.kill();
  await app.exited;
  await stopManagedRedis(redis);
  process.exit(process.exitCode ?? 0);
}

async function main(): Promise<void> {
  const redisUrl = resolveRedisUrlFromEnv();
  const managedRedis = await ensureRedisReady(redisUrl);

  const app = Bun.spawn({
    cmd: ["bun", "--watch", APP_ENTRY],
    env: { ...process.env, NODE_ENV: NODE_ENV_DEVELOPMENT },
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  process.once(SIGNAL_SIGINT, () => {
    void shutdown(app, managedRedis);
  });
  process.once(SIGNAL_SIGTERM, () => {
    void shutdown(app, managedRedis);
  });

  const exitCode = await app.exited;
  await stopManagedRedis(managedRedis);
  process.exit(exitCode);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
