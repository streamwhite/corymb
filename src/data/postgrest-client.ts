import { APP_DB_SCHEMA } from "@/constants/database.js";
import {
  type PostgrestConfig,
  resolvePostgrestConfigFromEnv,
} from "@/constants/postgrest.js";
import { PostgrestBuilder } from "@/data/postgrest-builder.js";
import { executePostgrest } from "@/data/postgrest-request.js";
import type {
  PostgrestAuth,
  PostgrestResponse,
  RpcArgs,
} from "@/data/postgrest-types.js";

const RPC_SEGMENT = "rpc";
const ANONYMOUS: PostgrestAuth = { kind: "anonymous" };
const HEALTH_STATUS_OK = 200;

export type CreatePostgrestClientOptions = Partial<PostgrestConfig> & {
  /** Injectable fetch (tests / custom transports). Defaults to global `fetch`. */
  fetch?: typeof fetch;
  /** Default authorization for requests. Defaults to the service token when configured. */
  auth?: PostgrestAuth;
};

export type PostgrestClient = {
  readonly schema: string;
  from<T = unknown>(table: string): PostgrestBuilder<T>;
  rpc<T = unknown>(fn: string, args?: RpcArgs): Promise<PostgrestResponse<T>>;
  /** Returns a client bound to the given auth context (e.g. the caller's JWT). */
  as(auth: PostgrestAuth): PostgrestClient;
  withToken(token: string): PostgrestClient;
  anonymous(): PostgrestClient;
  /** Best-effort reachability probe against the PostgREST root. */
  health(): Promise<boolean>;
};

function buildUrl(config: PostgrestConfig, path: string): string {
  return `${config.url}${path}`;
}

async function ping(config: PostgrestConfig, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(buildUrl(config, "/"), {
      method: "GET",
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    return response.status >= HEALTH_STATUS_OK && response.status < 300;
  } catch {
    return false;
  }
}

function createClient(
  config: PostgrestConfig,
  fetchImpl: typeof fetch,
  auth: PostgrestAuth,
): PostgrestClient {
  const rpcPath = (fn: string) => `/${RPC_SEGMENT}/${encodeURIComponent(fn)}`;
  return {
    schema: config.schema,
    from<T = unknown>(table: string): PostgrestBuilder<T> {
      return new PostgrestBuilder<T>(
        { config, fetchImpl, auth },
        `/${encodeURIComponent(table)}`,
      );
    },
    rpc<T = unknown>(
      fn: string,
      args: RpcArgs = {},
    ): Promise<PostgrestResponse<T>> {
      return executePostgrest<T>(config, fetchImpl, {
        method: "POST",
        path: rpcPath(fn),
        query: new URLSearchParams(),
        auth,
        body: args,
      });
    },
    as(next: PostgrestAuth): PostgrestClient {
      return createClient(config, fetchImpl, next);
    },
    withToken(token: string): PostgrestClient {
      return createClient(config, fetchImpl, { kind: "token", token });
    },
    anonymous(): PostgrestClient {
      return createClient(config, fetchImpl, ANONYMOUS);
    },
    health(): Promise<boolean> {
      return ping(config, fetchImpl);
    },
  };
}

export function createPostgrestClient(
  options: CreatePostgrestClientOptions = {},
): PostgrestClient {
  const envConfig = options.url === undefined ? resolvePostgrestConfigFromEnv() : null;
  const config: PostgrestConfig = {
    url: options.url ?? envConfig?.url ?? "",
    schema: options.schema ?? envConfig?.schema ?? APP_DB_SCHEMA,
    serviceToken: options.serviceToken ?? envConfig?.serviceToken,
    timeoutMs: options.timeoutMs ?? envConfig?.timeoutMs ?? 10_000,
  };
  const fetchImpl = options.fetch ?? fetch;
  const auth = options.auth ?? ANONYMOUS;
  return createClient(config, fetchImpl, auth);
}
