import { describe, expect, it } from "bun:test";
import { compose, passthrough } from "@/middleware/compose.js";
import { createMiddlewareRegistry } from "@/middleware/registry.js";
import type {
  Middleware,
  MiddlewareContext,
} from "@/middleware/middleware-types.js";
import { createLogger } from "@/observability/logger.js";

function ctxFor(path = "/"): MiddlewareContext {
  const req = new Request(`http://x.test${path}`);
  return {
    req,
    url: new URL(req.url),
    requestId: "r1",
    logger: createLogger({}, { level: "error", writer: () => {} }),
    cache: {} as MiddlewareContext["cache"],
    auth: {} as MiddlewareContext["auth"],
    storage: {} as MiddlewareContext["storage"],
    state: {},
  };
}

describe("middleware compose", () => {
  it("runs middleware in order around the handler", async () => {
    const order: string[] = [];
    const a: Middleware = async (_ctx, next) => {
      order.push("a:before");
      const res = await next();
      order.push("a:after");
      return res;
    };
    const b: Middleware = async (_ctx, next) => {
      order.push("b:before");
      const res = await next();
      order.push("b:after");
      return res;
    };
    const handler = compose([a, b], async () => {
      order.push("handler");
      return new Response("ok");
    });
    const res = await handler(ctxFor());
    expect(res.status).toBe(200);
    expect(order).toEqual(["a:before", "b:before", "handler", "b:after", "a:after"]);
  });

  it("lets middleware short-circuit", async () => {
    let called = false;
    const gate: Middleware = () => new Response("denied", { status: 403 });
    const handler = compose([gate], async () => {
      called = true;
      return new Response("ok");
    });
    const res = await handler(ctxFor());
    expect(res.status).toBe(403);
    expect(called).toBe(false);
  });

  it("rejects calling next twice", async () => {
    const bad: Middleware = async (_ctx, next) => {
      await next();
      return next();
    };
    const handler = compose([bad], async () => new Response("ok"));
    await expect(handler(ctxFor())).rejects.toThrow(/multiple times/);
  });

  it("exposes a passthrough middleware", async () => {
    const handler = compose([passthrough], async () => new Response("ok"));
    expect((await handler(ctxFor())).status).toBe(200);
  });
});

describe("middleware registry", () => {
  it("registers and picks middleware by name", () => {
    const registry = createMiddlewareRegistry();
    registry.use("auth", passthrough);
    registry.use("log", passthrough);
    expect(registry.get("auth")).toBe(passthrough);
    expect(registry.all()).toHaveLength(2);
    expect(registry.pick(["auth", "log"])).toHaveLength(2);
    expect(() => registry.pick(["missing"])).toThrow(/Unknown middleware/);
  });
});
