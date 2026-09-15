import { createApp } from "@/app.js";
import type { AppInstance, CreateAppOptions } from "@/app.js";
import {
  resolveListenHost,
  resolveListenPort,
} from "@/constants/server.js";
import { devTlsServeOptions, resolveDevTlsPaths } from "@/server/dev-tls.js";

export type StartServerOptions = CreateAppOptions & {
  port?: number;
  hostname?: string;
};

export type StartServerResult = {
  server: ReturnType<typeof Bun.serve>;
  app: AppInstance;
  url: URL;
};

export async function startServer(
  options: StartServerOptions = {},
): Promise<StartServerResult> {
  const tlsPaths = resolveDevTlsPaths();
  const tlsOpts = tlsPaths ? devTlsServeOptions(tlsPaths) : {};
  if (tlsPaths) {
    console.info(`TLS enabled (${tlsPaths.cert})`);
  }

  const app = await createApp(options);
  const server = Bun.serve({
    routes: app.routes,
    fetch: app.fetchNotFound,
    error: app.onServeError,
    port: options.port ?? resolveListenPort(),
    hostname: options.hostname ?? resolveListenHost(),
    ...tlsOpts,
  });

  return { server, app, url: server.url };
}