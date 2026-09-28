import { readBoolEnv, readEnv } from "@/config/env.js";

export const MCP_BASE_PATH = "/mcp" as const;

export const ENV_MCP_ENABLED = "MCP_ENABLED" as const;

/** Bearer token required to access the MCP endpoint. */
export const ENV_MCP_TOKEN = "MCP_TOKEN" as const;

export const ENV_MCP_NAME = "MCP_NAME" as const;

export const ENV_MCP_VERSION = "MCP_VERSION" as const;

export const DEFAULT_MCP_NAME = "corymb" as const;

export const DEFAULT_MCP_VERSION = "1.0.0" as const;

export const HEADER_MCP_SESSION_ID = "mcp-session-id" as const;

export const HEADER_MCP_PROTOCOL_VERSION = "mcp-protocol-version" as const;

export type McpConfig = {
  enabled: boolean;
  token?: string;
  name: string;
  version: string;
};

/** Reads MCP settings from env; disabled unless `MCP_ENABLED` is truthy. */
export function resolveMcpConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): McpConfig {
  return {
    enabled: readBoolEnv(ENV_MCP_ENABLED, false, env),
    token: readEnv(ENV_MCP_TOKEN, env),
    name: readEnv(ENV_MCP_NAME, env) ?? DEFAULT_MCP_NAME,
    version: readEnv(ENV_MCP_VERSION, env) ?? DEFAULT_MCP_VERSION,
  };
}
