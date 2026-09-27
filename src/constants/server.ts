import { isNodeEnvDevelopment } from "@/runtime/node-env.js";

export const ENV_PORT_KEY = "PORT" as const;

export const ENV_HOST_KEY = "HOST" as const;

export const ENV_SERVICE_NAME = "SERVICE_NAME" as const;

export const DEFAULT_SERVICE_NAME = "backend" as const;

export const DEFAULT_HTTP_PORT = 3000;

export function resolveServiceNameFromEnv(): string {
  const fromEnv = process.env[ENV_SERVICE_NAME];
  return fromEnv !== undefined && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_SERVICE_NAME;
}

const RADIX_DECIMAL = 10;

export function resolveListenPort(): number {
  const raw = process.env[ENV_PORT_KEY];
  const parsed =
    raw === undefined ? DEFAULT_HTTP_PORT : Number.parseInt(raw, RADIX_DECIMAL);
  return Number.isFinite(parsed) ? parsed : DEFAULT_HTTP_PORT;
}

/** Bind loopback in dev so `server.url` / WebAuthn rpID resolve to localhost. */
export const HOST_DEVELOPMENT = "localhost" as const;

/** Bind all interfaces in production (behind a reverse proxy). */
export const HOST_PRODUCTION = "0.0.0.0" as const;

/** Signals sent by `bun --watch` / process managers when restarting (graceful close). */
export const SIGNAL_SIGINT = "SIGINT" as const;

export const SIGNAL_SIGTERM = "SIGTERM" as const;

export function resolveListenHost(): string {
  const fromEnv = process.env[ENV_HOST_KEY];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  return isNodeEnvDevelopment() ? HOST_DEVELOPMENT : HOST_PRODUCTION;
}
