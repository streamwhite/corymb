import {
  POSTGREST_AUTHORIZATION_HEADER,
  POSTGREST_BEARER_PREFIX,
  type PostgrestConfig,
} from "@/constants/postgrest.js";
import { PostgrestError, toPostgrestError } from "@/data/postgrest-error.js";
import type { PostgrestAuth, PostgrestResponse } from "@/data/postgrest-types.js";

const HEADER_ACCEPT_PROFILE = "Accept-Profile";
const HEADER_CONTENT_PROFILE = "Content-Profile";
const HEADER_PREFER = "Prefer";
const HEADER_CONTENT_RANGE = "Content-Range";
const HEADER_CONTENT_TYPE = "Content-Type";
const JSON_CONTENT_TYPE = "application/json";
const NETWORK_ERROR_STATUS = 0;

export type PostgrestRequest = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  query: URLSearchParams;
  auth: PostgrestAuth;
  body?: unknown;
  prefer?: string[];
  /** Overrides the `Accept` header (e.g. `application/vnd.pgrst.object+json`). */
  accept?: string;
  /** When true, a 406 `PGRST116` (no/multiple rows for object accept) yields `data: null`. */
  tolerateNoRows?: boolean;
};

const HEADER_ACCEPT = "Accept";
const JSON_ACCEPT = "application/json";
const PGRST_NO_ROWS_CODE = "PGRST116";

type ResolvedAuth = { token?: string };

function resolveToken(
  config: PostgrestConfig,
  auth: PostgrestAuth,
): ResolvedAuth {
  if (auth.kind === "token") {
    return { token: auth.token };
  }
  return { token: config.serviceToken };
}

function applyAuthHeader(headers: Headers, token?: string): void {
  if (token !== undefined && token.length > 0) {
    headers.set(
      POSTGREST_AUTHORIZATION_HEADER,
      `${POSTGREST_BEARER_PREFIX}${token}`,
    );
  }
}

function applyProfileHeader(
  headers: Headers,
  config: PostgrestConfig,
  method: PostgrestRequest["method"],
): void {
  if (config.schema.length === 0) {
    return;
  }
  const header =
    method === "GET" ? HEADER_ACCEPT_PROFILE : HEADER_CONTENT_PROFILE;
  headers.set(header, config.schema);
}

function buildRequestUrl(config: PostgrestConfig, req: PostgrestRequest): string {
  const query = req.query.toString();
  const base = `${config.url}${req.path}`;
  return query.length > 0 ? `${base}?${query}` : base;
}

function buildHeaders(
  config: PostgrestConfig,
  req: PostgrestRequest,
): Headers {
  const headers = new Headers();
  headers.set(HEADER_CONTENT_TYPE, JSON_CONTENT_TYPE);
  headers.set(HEADER_ACCEPT, req.accept ?? JSON_ACCEPT);
  applyAuthHeader(headers, resolveToken(config, req.auth).token);
  applyProfileHeader(headers, config, req.method);
  if (req.prefer !== undefined && req.prefer.length > 0) {
    headers.set(HEADER_PREFER, req.prefer.join(","));
  }
  return headers;
}

function parseCount(response: Response): number | null {
  const raw = response.headers.get(HEADER_CONTENT_RANGE);
  if (raw === null) {
    return null;
  }
  const total = raw.split("/")[1];
  if (total === undefined || total === "*") {
    return null;
  }
  const parsed = Number.parseInt(total, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return null as T;
  }
  const text = await response.text();
  return text.length > 0 ? (JSON.parse(text) as T) : (null as T);
}

async function throwOrTolerate(
  response: Response,
  tolerateNoRows: boolean | undefined,
): Promise<PostgrestError | null> {
  const error = await toPostgrestError(response);
  if (
    tolerateNoRows === true &&
    response.status === 406 &&
    error.code === PGRST_NO_ROWS_CODE
  ) {
    return null;
  }
  return error;
}

function asNetworkError(err: unknown): PostgrestError {
  const message = err instanceof Error ? err.message : String(err);
  return new PostgrestError(NETWORK_ERROR_STATUS, {
    message: `PostgREST request failed: ${message}`,
  });
}

export async function executePostgrest<T>(
  config: PostgrestConfig,
  fetchImpl: typeof fetch,
  req: PostgrestRequest,
): Promise<PostgrestResponse<T>> {
  let response: Response;
  try {
    response = await fetchImpl(buildRequestUrl(config, req), {
      method: req.method,
      headers: buildHeaders(config, req),
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (err) {
    throw asNetworkError(err);
  }
  if (!response.ok) {
    const error = await throwOrTolerate(response, req.tolerateNoRows);
    if (error === null) {
      return { data: null as T, count: null, status: response.status };
    }
    throw error;
  }
  return {
    data: await parseBody<T>(response),
    count: parseCount(response),
    status: response.status,
  };
}
