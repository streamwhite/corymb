import {
  DEFAULT_MCP_NAME,
  DEFAULT_MCP_VERSION,
} from "@/constants/mcp.js";
import { HEADER_AUTHORIZATION } from "@/constants/http-security.js";
import {
  HTTP_STATUS_INTERNAL,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import { MSG_INTERNAL } from "@/constants/messages.js";
import { verifySignature } from "@/http/cookies.js";
import type { FeatureFlags } from "@/flags/feature-flags.js";
import type { Logger } from "@/observability/logger.js";

const BEARER_PREFIX = "Bearer " as const;
const JSONRPC_VERSION = "2.0" as const;
const JSONRPC_INTERNAL_ERROR = -32603 as const;

type Sdk = {
  McpServer: typeof import("@modelcontextprotocol/sdk/server/mcp.js").McpServer;
  WebStandardStreamableHTTPServerTransport: typeof import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js").WebStandardStreamableHTTPServerTransport;
  z: typeof import("zod");
};

let sdkPromise: Promise<Sdk> | undefined;

function loadSdk(): Promise<Sdk> {
  sdkPromise ??= (async () => {
    const [mcp, transport, z] = await Promise.all([
      import("@modelcontextprotocol/sdk/server/mcp.js"),
      import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"),
      import("zod"),
    ]);
    return {
      McpServer: mcp.McpServer,
      WebStandardStreamableHTTPServerTransport:
        transport.WebStandardStreamableHTTPServerTransport,
      z,
    };
  })();
  return sdkPromise;
}

export type McpDeps = {
  /** Application name/version reported to clients. */
  name: string;
  version: string;
  environment: string;
  logger: Logger;
  /** Readiness-style dependency checks. */
  health: () => Promise<Record<string, boolean>>;
  flags?: FeatureFlags;
  taskCounts?: () => Promise<Record<string, number>>;
};

export type McpOptions = {
  /** Bearer token required on every request. */
  token: string;
  name?: string;
  version?: string;
};

export type McpHandler = (req: Request) => Promise<Response>;

function bearerToken(req: Request): string | undefined {
  const header = req.headers.get(HEADER_AUTHORIZATION);
  if (header === null || !header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
}

function authorize(req: Request, expected: string): Response | null {
  const provided = bearerToken(req);
  if (provided !== undefined && verifySignature(provided, expected)) {
    return null;
  }
  return Response.json(
    { error: "Unauthorized" },
    { status: HTTP_STATUS_UNAUTHORIZED },
  );
}

function textContent(value: unknown): {
  content: { type: "text"; text: string }[];
} {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function registerIntrospectionTools(
  server: InstanceType<Sdk["McpServer"]>,
  deps: McpDeps,
): void {
  server.registerTool(
    "app_info",
    { description: "Application name, version and enabled feature flags." },
    async () => {
      const flags = deps.flags === undefined ? {} : await deps.flags.all();
      return textContent({
        name: deps.name,
        version: deps.version,
        environment: deps.environment,
        featureFlags: Object.keys(flags).filter((key) => flags[key] === true),
      });
    },
  );

  server.registerTool(
    "health",
    { description: "Dependency health checks (cache, PostgREST, ...)." },
    async () => textContent(await deps.health()),
  );

  const flags = deps.flags;
  if (flags !== undefined) {
    server.registerTool(
      "list_feature_flags",
      { description: "All configured feature flags and their state." },
      async () => textContent(await flags.all()),
    );
  }

  const taskCounts = deps.taskCounts;
  if (taskCounts !== undefined) {
    server.registerTool(
      "task_counts",
      { description: "Background job queue counts by state." },
      async () => textContent(await taskCounts()),
    );
  }
}

function registerExampleTool(
  server: InstanceType<Sdk["McpServer"]>,
  z: Sdk["z"],
): void {
  server.registerTool(
    "echo",
    {
      description: "Echoes a message back (example tool to extend).",
      inputSchema: { message: z.string().describe("Message to echo") },
    },
    async ({ message }) => textContent({ message }),
  );
}

function errorResponse(message: string): Response {
  return Response.json(
    {
      jsonrpc: JSONRPC_VERSION,
      error: { code: JSONRPC_INTERNAL_ERROR, message },
      id: null,
    },
    { status: HTTP_STATUS_INTERNAL },
  );
}

/**
 * Builds a stateless Streamable-HTTP MCP handler (JSON responses). Each request
 * gets a fresh server/transport; the SDK is loaded lazily on first use.
 */
export function createMcpHandler(
  deps: McpDeps,
  options: McpOptions,
): McpHandler {
  const name = options.name ?? deps.name ?? DEFAULT_MCP_NAME;
  const version = options.version ?? deps.version ?? DEFAULT_MCP_VERSION;
  return async (req) => {
    const denied = authorize(req, options.token);
    if (denied !== null) {
      return denied;
    }
    try {
      const { McpServer, WebStandardStreamableHTTPServerTransport, z } =
        await loadSdk();
      const server = new McpServer({ name, version });
      registerIntrospectionTools(server, deps);
      registerExampleTool(server, z);
      const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
      });
      await server.connect(transport);
      return await transport.handleRequest(req);
    } catch (err) {
      deps.logger.error("mcp request failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return errorResponse(MSG_INTERNAL);
    }
  };
}

/** Wraps an MCP handler as `Bun.serve` route methods for a single path. */
export function buildMcpRoutes(
  path: string,
  handler: McpHandler,
): Record<string, Record<string, McpHandler>> {
  return { [path]: { POST: handler, GET: handler, DELETE: handler } };
}
