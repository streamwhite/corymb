# MCP server

Expose the app as a stateless **Streamable-HTTP Model Context Protocol** endpoint
at `/mcp` (`MCP_BASE_PATH`). Every `POST`/`GET`/`DELETE` requires
`Authorization: Bearer <token>` (constant-time compare). Responses are JSON (not
SSE streams); a fresh `McpServer` + transport is built per request.

## Enable

```ts
// Option form (independent of env):
const app = await createApp({ mcp: { token: process.env.MCP_TOKEN! } });

// Env form:
// MCP_ENABLED=true MCP_TOKEN=... bun run start
const app = await createApp();
```

`createApp` wiring: `buildMcpRoutes(MCP_BASE_PATH, createMcpHandler(deps, opts))`
is merged before `options.routes`, so consumer routes win on path conflict.
`mcp: false` disables. Enabling via env without `MCP_TOKEN` throws at startup.

## Manual construction

```ts
import { buildMcpRoutes, createMcpHandler, createLogger, createStaticFeatureFlags } from "corymb";

const handler = createMcpHandler(
  {
    name: "my-app",
    version: "1.0.0",
    environment: "production",
    logger: createLogger(),
    health: async () => ({ cache: true }),
    flags: createStaticFeatureFlags({ beta: true }),   // enables list_feature_flags
    taskCounts: async () => ({ waiting: 0, active: 0 }), // enables task_counts
  },
  { token: process.env.MCP_TOKEN! },
);

const routes = buildMcpRoutes("/mcp", handler);
// => { "/mcp": { POST: handler, GET: handler, DELETE: handler } }
```

## Built-in tools

`app_info`, `health`, `echo`, plus `list_feature_flags` (when `flags` is provided)
and `task_counts` (when `taskCounts` is provided). Internal failures return
JSON-RPC code `-32603` with HTTP `500`.

Env: `MCP_ENABLED` (false), `MCP_TOKEN`, `MCP_NAME` (`corymb`),
`MCP_VERSION` (`1.0.0`). Exports: `createMcpHandler`, `buildMcpRoutes`,
`MCP_BASE_PATH`, `resolveMcpConfigFromEnv`, `DEFAULT_MCP_NAME`,
`DEFAULT_MCP_VERSION`, `ENV_MCP_ENABLED`, `ENV_MCP_TOKEN`, `ENV_MCP_NAME`,
`ENV_MCP_VERSION`.

**Gotcha:** the SDK and `zod` load lazily on first request; tokens must be set
before startup, not per request.
