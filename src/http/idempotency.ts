import type { Cache } from "@/cache/cache-types.js";
import {
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  HEADER_IDEMPOTENCY_KEY,
  HEADER_IDEMPOTENT_REPLAY,
  IDEMPOTENCY_KEY_MAX_CHARS,
  IDEMPOTENCY_KEY_PREFIX,
} from "@/constants/idempotency.js";
import { HTTP_STATUS_CONFLICT } from "@/constants/http-status.js";
import { jsonApiResponse } from "@/http/json-response.js";
import type { Logger } from "@/observability/logger.js";

export type IdempotencyOptions = {
  cache: Cache;
  logger: Logger;
  /** Path prefixes that require an idempotency key (e.g. mutating routes). */
  protectedPaths: string[];
  /** How long a stored response stays replayable (seconds). */
  ttlSeconds?: number;
};

type StoredResponse = {
  status: number;
  body: string;
  contentType: string | null;
  requestHash: string;
};

const IDEMPOTENT_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const HASH_ALGORITHM = "sha256" as const;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

function cacheKey(key: string): string {
  return `${IDEMPOTENCY_KEY_PREFIX}:${key}`;
}

function isProtected(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

function isValidKey(key: string | null): key is string {
  return (
    key !== null && key.trim().length > 0 && key.length <= IDEMPOTENCY_KEY_MAX_CHARS
  );
}

async function hashBody(req: Request): Promise<string> {
  const raw = await req.clone().arrayBuffer();
  return new Bun.CryptoHasher(HASH_ALGORITHM).update(raw).digest("hex");
}

function parseStored(raw: string | null): StoredResponse | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as StoredResponse;
  } catch {
    return null;
  }
}

function replayResponse(stored: StoredResponse): Response {
  const headers = new Headers({ [HEADER_IDEMPOTENT_REPLAY]: "true" });
  if (stored.contentType !== null) {
    headers.set("Content-Type", stored.contentType);
  }
  return new Response(stored.body, { status: stored.status, headers });
}

function conflict(url: URL, message: string): Response {
  return jsonApiResponse({ error: message }, { status: HTTP_STATUS_CONFLICT }, url);
}

/**
 * Enforces `Idempotency-Key` on protected mutating paths. The first request runs
 * and its successful response is cached; identical retries replay that response,
 * and reuse with a different body gets `409`. Concurrent duplicates in the same
 * process get `409` (in-process lock), while stored responses are shared via the
 * cache across replicas.
 */
export function createIdempotencyGuard(
  options: IdempotencyOptions,
): (req: Request, handler: () => Promise<Response>) => Promise<Response> {
  const ttl = options.ttlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS;
  const inFlight = new Set<string>();

  return async (req, handler) => {
    const url = new URL(req.url);
    if (
      !IDEMPOTENT_METHODS.has(req.method) ||
      !isProtected(url.pathname, options.protectedPaths)
    ) {
      return handler();
    }
    const key = req.headers.get(HEADER_IDEMPOTENCY_KEY);
    if (!isValidKey(key)) {
      return conflict(url, `${HEADER_IDEMPOTENCY_KEY} header is required`);
    }
    const hash = await hashBody(req);
    const stored = parseStored(await options.cache.get(cacheKey(key)));
    if (stored !== null) {
      if (stored.requestHash !== hash) {
        return conflict(url, "Idempotency key reused with a different request");
      }
      options.logger.info("idempotent replay", { key, path: url.pathname });
      return replayResponse(stored);
    }
    if (inFlight.has(key)) {
      return conflict(url, "Request with this Idempotency-Key is in progress");
    }
    inFlight.add(key);
    try {
      const res = await handler();
      if (res.status >= HTTP_OK_MIN && res.status <= HTTP_OK_MAX) {
        await options.cache.set(
          cacheKey(key),
          JSON.stringify({
            status: res.status,
            body: await res.clone().text(),
            contentType: res.headers.get("Content-Type"),
            requestHash: hash,
          } satisfies StoredResponse),
          ttl,
        );
      }
      return res;
    } finally {
      inFlight.delete(key);
    }
  };
}

export { HEADER_IDEMPOTENT_REPLAY };
