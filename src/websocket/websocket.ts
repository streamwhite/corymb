import type { ServerWebSocket } from "bun";

export const WS_DATA_AUTH_PENDING = "pending" as const;

export const WS_CLOSE_UNAUTHORIZED = 1008 as const;

export const WS_CLOSE_INTERNAL = 1011 as const;

/** Per-connection data attached at upgrade time. */
export type WebSocketData = {
  /** Connection id (stable per socket). */
  connectionId: string;
  /** Path the client connected to. */
  path: string;
  /** Arbitrary auth/context resolved before upgrade. */
  auth?: unknown;
  [key: string]: unknown;
};

export type WebSocketConnection = ServerWebSocket<WebSocketData>;

/** Handlers for a named websocket route. */
export type WebSocketRouteHandlers = {
  open?: (ws: WebSocketConnection) => void | Promise<void>;
  message?: (
    ws: WebSocketConnection,
    message: string | Buffer,
  ) => void | Promise<void>;
  close?: (
    ws: WebSocketConnection,
    code: number,
    reason: string,
  ) => void | Promise<void>;
  drain?: (ws: WebSocketConnection) => void | Promise<void>;
};

export type WebSocketLimits = {
  maxPayloadLength?: number;
  backpressureLimit?: number;
  idleTimeout?: number;
  sendPings?: boolean;
};

/**
 * A websocket endpoint. `path` is matched by the upgrade route; `handlers`
 * receive connections already authorized by `authorize` (if provided).
 */
export type WebSocketEndpoint = WebSocketRouteHandlers & {
  path: string;
  /** Runs before upgrade; return false (or throw) to reject with 401. */
  authorize?: (req: Request) => boolean | Promise<boolean>;
  limits?: WebSocketLimits;
};

/** Builds the `websocket` option for `Bun.serve` from registered endpoints. */
export type WebSocketServer = {
  handler: Bun.WebSocketHandler<WebSocketData>;
  endpointFor: (path: string) => WebSocketEndpoint | undefined;
  /** Registered endpoint paths (used to build upgrade routes). */
  paths: string[];
};

const MAX_PAYLOAD_DEFAULT = 1024 * 1024;
const IDLE_TIMEOUT_DEFAULT = 120;

function messageHandler(
  endpointFor: (path: string) => WebSocketEndpoint | undefined,
): Bun.WebSocketHandler<WebSocketData>["message"] {
  return async (ws, message) => {
    const endpoint = endpointFor(ws.data.path);
    if (endpoint?.message === undefined) return;
    await endpoint.message(ws, message);
  };
}

/**
 * Registers websocket endpoints and produces the `Bun.serve` handler plus a
 * path lookup used by the upgrade route. Endpoints are matched by exact path.
 */
export function createWebSocketServer(
  endpoints: WebSocketEndpoint[],
): WebSocketServer {
  const byPath = new Map(endpoints.map((endpoint) => [endpoint.path, endpoint]));
  const endpointFor = (path: string) => byPath.get(path);
  const lookup = messageHandler(endpointFor);

  const handler: Bun.WebSocketHandler<WebSocketData> = {
    maxPayloadLength: MAX_PAYLOAD_DEFAULT,
    idleTimeout: IDLE_TIMEOUT_DEFAULT,
    async open(ws) {
      await endpointFor(ws.data.path)?.open?.(ws);
    },
    message: lookup,
    async close(ws, code, reason) {
      await endpointFor(ws.data.path)?.close?.(ws, code, reason);
    },
    async drain(ws) {
      await endpointFor(ws.data.path)?.drain?.(ws);
    },
  };

  return { handler, endpointFor, paths: [...byPath.keys()] };
}

export type UpgradeServer = {
  upgrade: (
    req: Request,
    options: { data: WebSocketData; headers?: HeadersInit },
  ) => boolean;
};

export function makeWebSocketData(
  req: Request,
  auth?: unknown,
): WebSocketData {
  return {
    connectionId: crypto.randomUUID(),
    path: new URL(req.url).pathname,
    auth,
  };
}

/** Minimal `Bun.serve` server shape needed to upgrade a request. */
export type UpgradeCapableServer = {
  upgrade: (
    req: Request,
    options: { data: WebSocketData; headers?: HeadersInit },
  ) => boolean;
};

const HTTP_STATUS_UNAUTHORIZED = 401;

function unauthorized(): Response {
  return Response.json(
    { error: "Unauthorized" },
    { status: HTTP_STATUS_UNAUTHORIZED },
  );
}

/**
 * Builds a handler that authorizes and upgrades a request to the websocket
 * endpoint registered for `path`. Returns `undefined` on successful upgrade (the
 * connection is handed to the websocket handler) or a `401` response when
 * rejected. Callers only invoke it for websocket requests.
 */
export function createWebSocketUpgrade(
  path: string,
  server: WebSocketServer,
): (
  req: Request,
  bunServer: UpgradeCapableServer,
) => Promise<Response | undefined> {
  return async (req, bunServer) => {
    const endpoint = server.endpointFor(path);
    if (endpoint === undefined) {
      return undefined;
    }
    if (endpoint.authorize !== undefined) {
      const allowed = await endpoint.authorize(req);
      if (!allowed) {
        return unauthorized();
      }
    }
    return bunServer.upgrade(req, { data: makeWebSocketData(req) })
      ? undefined
      : unauthorized();
  };
}
