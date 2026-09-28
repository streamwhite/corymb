import { describe, expect, it } from "bun:test";
import { HEADER_AUTHORIZATION } from "@/constants/http-security.js";
import { createStaticFeatureFlags } from "@/flags/feature-flags.js";
import { createMcpHandler, type McpHandler } from "@/mcp/mcp-server.js";
import { createLogger } from "@/observability/logger.js";
import { createMemoryApp } from "./helpers/app-memory.js";

const TOKEN = "mcp-test-token" as const;

const JSON_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
} as const;

function testHandler(): McpHandler {
  return createMcpHandler(
    {
      name: "test-app",
      version: "0.0.0",
      environment: "test",
      logger: createLogger({}, { level: "error", writer: () => {} }),
      health: async () => ({ cache: true }),
      flags: createStaticFeatureFlags({ beta: true }),
      taskCounts: async () => ({ waiting: 0 }),
    },
    { token: TOKEN },
  );
}

function rpc(method: string, params?: unknown, id = 1): Request {
  return new Request("http://x.test/mcp", {
    method: "POST",
    headers: { ...JSON_HEADERS, [HEADER_AUTHORIZATION]: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

function initializeRequest(): Request {
  return rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });
}

describe("mcp authentication", () => {
  it("rejects requests without a bearer token", async () => {
    const handler = testHandler();
    const req = new Request("http://x.test/mcp", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect((await handler(req)).status).toBe(401);
  });

  it("rejects requests with a wrong token", async () => {
    const handler = testHandler();
    const req = new Request("http://x.test/mcp", {
      method: "POST",
      headers: { ...JSON_HEADERS, [HEADER_AUTHORIZATION]: "Bearer nope" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect((await handler(req)).status).toBe(401);
  });
});

describe("mcp protocol", () => {
  it("handles initialize", async () => {
    const handler = testHandler();
    const res = await handler(initializeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { serverInfo?: { name?: string } };
    };
    expect(body.result?.serverInfo?.name).toBe("test-app");
  });

  it("lists the introspection and example tools", async () => {
    const handler = testHandler();
    const res = await handler(rpc("tools/list", {}));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { tools?: { name: string }[] };
    };
    const names = (body.result?.tools ?? []).map((tool) => tool.name);
    expect(names).toContain("app_info");
    expect(names).toContain("health");
    expect(names).toContain("list_feature_flags");
    expect(names).toContain("task_counts");
    expect(names).toContain("echo");
  });

  it("calls the example echo tool", async () => {
    const handler = testHandler();
    const res = await handler(
      rpc("tools/call", { name: "echo", arguments: { message: "hi" } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { content?: { text: string }[] };
    };
    expect(body.result?.content?.[0]?.text).toContain("hi");
  });

  it("serves the /mcp route through the app", async () => {
    const { app } = await createMemoryApp({ mcp: { token: TOKEN } });
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { ...JSON_HEADERS, [HEADER_AUTHORIZATION]: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBe(200);
  });
});
