import { describe, expect, it } from "bun:test";
import { DEFAULT_CORS_HEADERS, DEFAULT_CORS_METHODS, type CorsConfig } from "@/constants/cors.js";
import { HEADER_REQUEST_ID } from "@/constants/observability.js";
import { READY_BASE_PATH, HEALTH_BASE_PATH } from "@/constants/routes.js";
import { errorResponse } from "@/http/error-response.js";
import { createLogger } from "@/observability/logger.js";
import { resolveRequestId } from "@/observability/request-id.js";
import { createMemoryApp } from "./helpers/app-memory.js";
import { PG_AVAILABLE } from "./helpers/test-db.js";

const ALLOWED_ORIGIN = "https://app.example.com" as const;

const cors: CorsConfig = {
  origins: [ALLOWED_ORIGIN],
  credentials: true,
  methods: [...DEFAULT_CORS_METHODS],
  headers: [...DEFAULT_CORS_HEADERS],
  maxAgeSeconds: 600,
};

describe("request id + unified errors", () => {
  it("reuses an inbound request id and generates one otherwise", () => {
    const inbound = new Request("http://x.test/", {
      headers: { [HEADER_REQUEST_ID]: "req-123" },
    });
    expect(resolveRequestId(inbound)).toBe("req-123");
    const generated = resolveRequestId(new Request("http://x.test/"));
    expect(generated.length).toBeGreaterThan(0);
  });

  it("shapes error responses with an optional request id", async () => {
    const res = errorResponse(418, "teapot", { requestId: "req-9" });
    expect(res.status).toBe(418);
    expect(res.headers.get(HEADER_REQUEST_ID)).toBe("req-9");
    expect(await res.json()).toEqual({ error: "teapot", requestId: "req-9" });
  });

  it("redacts sensitive fields from structured logs", () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: unknown) => lines.push(String(line));
    try {
      createLogger({ service: "test" }, { level: "debug" }).info("auth", {
        token: "secret-token",
        password: "hunter2",
        userId: "u1",
      });
    } finally {
      console.log = original;
    }
    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(parsed.token).toBe("[redacted]");
    expect(parsed.password).toBe("[redacted]");
    expect(parsed.userId).toBe("u1");
  });
});

describe.skipIf(!PG_AVAILABLE)("CORS + readiness", () => {
  it("answers preflight for allowed origins", async () => {
    const { app } = await createMemoryApp({ cors });
    const res = await app.request(HEALTH_BASE_PATH, {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("does not allow preflight from unlisted origins", async () => {
    const { app } = await createMemoryApp({ cors });
    const res = await app.request(HEALTH_BASE_PATH, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("echoes request ids on responses", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(HEALTH_BASE_PATH, {
      headers: { [HEADER_REQUEST_ID]: "trace-42" },
    });
    expect(res.headers.get(HEADER_REQUEST_ID)).toBe("trace-42");
  });

  it("reports ready without PostgREST configured", async () => {
    const { app } = await createMemoryApp({ data: false });
    const res = await app.request(READY_BASE_PATH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; checks: Record<string, boolean> };
    expect(body.status).toBe("ready");
    expect(body.checks.cache).toBe(true);
    expect(body.checks.postgrest).toBeUndefined();
  });

  it("exposes audit, task and storage wiring on the app instance", async () => {
    const seen: string[] = [];
    const { app } = await createMemoryApp({
      auditSinks: [
        (event) => {
          seen.push(event.action);
        },
      ],
    });
    await app.instance.audit({ action: "auth.signin", actor: { id: "u1" } });
    expect(seen).toEqual(["auth.signin"]);
    expect(typeof app.instance.tasks.register).toBe("function");
    expect(app.instance.storage.driver).toBe("memory");
  });

  it("reports unavailable when PostgREST is unreachable", async () => {
    const { app } = await createMemoryApp({
      data: {
        url: "http://postgrest.test",
        fetch: (async () =>
          new Response("down", { status: 500 })) as unknown as typeof fetch,
      },
    });
    const res = await app.request(READY_BASE_PATH);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { checks: Record<string, boolean> };
    expect(body.checks.postgrest).toBe(false);
  });
});
