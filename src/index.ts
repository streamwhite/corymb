import { serve } from "@hono/node-server";
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

const port = resolveListenPort();
const { app } = createApp();

const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname: HOST_FALLBACK,
  },
  (info) => {
    console.info(
      `Server listening on http://${HOST_FALLBACK}:${String(info.port)}`,
    );
  },
);

let isShuttingDown = false;

function shutdown(): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.once(SIGNAL_SIGINT, shutdown);
process.once(SIGNAL_SIGTERM, shutdown);
