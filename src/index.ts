import { createApp } from "@/app.js";
import {
  DEFAULT_HTTP_PORT,
  ENV_PORT_KEY,
  HOST_FALLBACK,
  SIGNAL_SIGINT,
  SIGNAL_SIGTERM,
} from "@/constants/server.js";

const RADIX_DECIMAL = 10;

function resolveListenPort(): number {
  const raw = process.env[ENV_PORT_KEY];
  const parsed =
    raw === undefined ? DEFAULT_HTTP_PORT : Number.parseInt(raw, RADIX_DECIMAL);
  return Number.isFinite(parsed) ? parsed : DEFAULT_HTTP_PORT;
}

const { app } = createApp();

const server = Bun.serve({
  fetch: app.fetch,
  port: resolveListenPort(),
  hostname: HOST_FALLBACK,
});

console.info(`Server listening on ${server.url.href}`);

let isShuttingDown = false;

async function shutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  try {
    await server.stop();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}

process.once(SIGNAL_SIGINT, () => {
  void shutdown();
});
process.once(SIGNAL_SIGTERM, () => {
  void shutdown();
});
