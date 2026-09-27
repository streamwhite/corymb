import { describe, expect, it } from "bun:test";
import { createMemoryCache } from "@/cache/memory-cache.js";
import {
  HEADER_IDEMPOTENCY_KEY,
  HEADER_IDEMPOTENT_REPLAY,
} from "@/constants/idempotency.js";
import { createIdempotencyGuard } from "@/http/idempotency.js";
import { createLogger } from "@/observability/logger.js";

const silentLogger = createLogger({}, { level: "error", writer: () => {} });
const PROTECTED = "/api/pay" as const;

function guard() {
  return createIdempotencyGuard({
    cache: createMemoryCache(),
    logger: silentLogger,
    protectedPaths: [PROTECTED],
  });
}

function post(key?: string, body = "{}"): Request {
  return new Request(`http://x.test${PROTECTED}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key === undefined ? {} : { [HEADER_IDEMPOTENCY_KEY]: key }),
    },
    body,
  });
}

describe("idempotency guard", () => {
  it("passes through unprotected paths without a key", async () => {
    let calls = 0;
    const res = await guard()(
      new Request("http://x.test/api/other", { method: "POST" }),
      async () => {
        calls += 1;
        return Response.json({ ok: true });
      },
    );
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
  });

  it("requires a key on protected mutating paths", async () => {
    const res = await guard()(post(), async () => Response.json({ ok: true }));
    expect(res.status).toBe(409);
  });

  it("replays the stored response for an identical retry", async () => {
    const g = guard();
    let calls = 0;
    const handler = async () => {
      calls += 1;
      return Response.json({ id: "42" }, { status: 201 });
    };
    const first = await g(post("key-1"), handler);
    expect(first.status).toBe(201);
    const second = await g(post("key-1"), handler);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual({ id: "42" });
    expect(second.headers.get(HEADER_IDEMPOTENT_REPLAY)).toBe("true");
    expect(calls).toBe(1);
  });

  it("rejects key reuse with a different body", async () => {
    const g = guard();
    await g(post("key-2", '{"a":1}'), async () => Response.json({ ok: true }));
    const res = await g(post("key-2", '{"a":2}'), async () =>
      Response.json({ ok: true }),
    );
    expect(res.status).toBe(409);
  });

  it("does not store failed responses", async () => {
    const g = guard();
    let calls = 0;
    const failing = async () => {
      calls += 1;
      return Response.json({ error: "boom" }, { status: 500 });
    };
    await g(post("key-3"), failing);
    await g(post("key-3"), failing);
    expect(calls).toBe(2);
  });
});
