import { serve } from "@hono/node-server";
import { createApp } from "@/app.js";
import {
  DEFAULT_HTTP_PORT,
  ENV_PORT_KEY,
  HOST_FALLBACK,
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

serve(
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
