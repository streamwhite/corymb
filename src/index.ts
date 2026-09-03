import { createApp } from "@/app.js";
import {
  DEFAULT_HTTP_PORT,
  ENV_PORT_KEY,
  SIGNAL_SIGINT,
  SIGNAL_SIGTERM,
  resolveListenHost,
} from "@/constants/server.js";
import { devTlsServeOptions, resolveDevTlsPaths } from "@/server/dev-tls.js";

const RADIX_DECIMAL = 10;

function resolveListenPort(): number {
  const raw = process.env[ENV_PORT_KEY];
  const parsed =
    raw === undefined ? DEFAULT_HTTP_PORT : Number.parseInt(raw, RADIX_DECIMAL);
  return Number.isFinite(parsed) ? parsed : DEFAULT_HTTP_PORT;
}

let isShuttingDown = false;

async function shutdown(
  server: ReturnType<typeof Bun.serve>,
  closeApp: () => Promise<void>,
): Promise<void> {
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
  try {
    await closeApp();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}

async function main(): Promise<void> {
  const tlsPaths = resolveDevTlsPaths();
  const tlsOpts = tlsPaths ? devTlsServeOptions(tlsPaths) : {};
  if (tlsPaths) {
    console.info(`TLS enabled (${tlsPaths.cert})`);
  }

  const app = await createApp();
  const server = Bun.serve({
    routes: app.routes,
    fetch: app.fetchNotFound,
    error: app.onServeError,
    port: resolveListenPort(),
    hostname: resolveListenHost(),
    ...tlsOpts,
  });

  console.info(`Server listening on ${server.url.href}`);

  process.once(SIGNAL_SIGINT, () => {
    void shutdown(server, app.close);
  });
  process.once(SIGNAL_SIGTERM, () => {
    void shutdown(server, app.close);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
