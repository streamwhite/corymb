import { readBoolEnv, readListEnv } from "@/config/env.js";
import {
  CORS_WILDCARD,
  type CorsConfig,
  DEFAULT_CORS_HEADERS,
  DEFAULT_CORS_MAX_AGE_SECONDS,
  DEFAULT_CORS_METHODS,
  ENV_CORS_CREDENTIALS,
  ENV_CORS_ORIGINS,
  HEADER_ALLOW_CREDENTIALS,
  HEADER_ALLOW_HEADERS,
  HEADER_ALLOW_METHODS,
  HEADER_ALLOW_ORIGIN,
  HEADER_MAX_AGE,
  HEADER_ORIGIN,
  HEADER_VARY,
} from "@/constants/cors.js";
import { HTTP_STATUS_NO_CONTENT } from "@/constants/http-status.js";

export function resolveCorsFromEnv(
  env: Record<string, string | undefined> = process.env,
): CorsConfig {
  return {
    origins: readListEnv(ENV_CORS_ORIGINS, [], env),
    credentials: readBoolEnv(ENV_CORS_CREDENTIALS, false, env),
    methods: [...DEFAULT_CORS_METHODS],
    headers: [...DEFAULT_CORS_HEADERS],
    maxAgeSeconds: DEFAULT_CORS_MAX_AGE_SECONDS,
  };
}

export function isCorsEnabled(config: CorsConfig): boolean {
  return config.origins.length > 0;
}

function allowsOrigin(origin: string, config: CorsConfig): boolean {
  return (
    config.origins.includes(CORS_WILDCARD) || config.origins.includes(origin)
  );
}

function resolveAllowOrigin(origin: string, config: CorsConfig): string | null {
  if (!allowsOrigin(origin, config)) {
    return null;
  }
  if (config.origins.includes(CORS_WILDCARD) && !config.credentials) {
    return CORS_WILDCARD;
  }
  return origin;
}

function applyCorsHeaders(
  headers: Headers,
  allowOrigin: string,
  req: Request,
  config: CorsConfig,
): void {
  headers.set(HEADER_ALLOW_ORIGIN, allowOrigin);
  headers.append(HEADER_VARY, HEADER_ORIGIN);
  if (config.credentials) {
    headers.set(HEADER_ALLOW_CREDENTIALS, "true");
  }
  if (req.method === "OPTIONS") {
    headers.set(HEADER_ALLOW_METHODS, config.methods.join(", "));
    headers.set(HEADER_ALLOW_HEADERS, config.headers.join(", "));
    headers.set(HEADER_MAX_AGE, String(config.maxAgeSeconds));
  }
}

/** Returns a preflight response for allowed cross-origin `OPTIONS`, else null. */
export function corsPreflight(
  req: Request,
  config: CorsConfig,
): Response | null {
  if (req.method !== "OPTIONS" || !isCorsEnabled(config)) {
    return null;
  }
  const origin = req.headers.get(HEADER_ORIGIN);
  if (origin === null) {
    return null;
  }
  const allowOrigin = resolveAllowOrigin(origin, config);
  if (allowOrigin === null) {
    return null;
  }
  const headers = new Headers();
  applyCorsHeaders(headers, allowOrigin, req, config);
  return new Response(null, { status: HTTP_STATUS_NO_CONTENT, headers });
}

export function applyCors(
  req: Request,
  res: Response,
  config: CorsConfig,
): Response {
  if (!isCorsEnabled(config)) {
    return res;
  }
  const origin = req.headers.get(HEADER_ORIGIN);
  if (origin === null) {
    return res;
  }
  const allowOrigin = resolveAllowOrigin(origin, config);
  if (allowOrigin === null) {
    return res;
  }
  const headers = new Headers(res.headers);
  applyCorsHeaders(headers, allowOrigin, req, config);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
