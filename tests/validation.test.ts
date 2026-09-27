import { describe, expect, it } from "bun:test";
import { compose } from "@/middleware/compose.js";
import { withValidation } from "@/middleware/builtin/validation.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import { ValidationError } from "@/errors/app-error.js";
import { createLogger } from "@/observability/logger.js";

function ctxFor(req: Request): MiddlewareContext {
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

const parseTodo = (input: unknown): { title: string } => {
  const obj = input as { title?: unknown };
  if (typeof obj.title !== "string" || obj.title.trim().length === 0) {
    throw new ValidationError("title is required", { field: "title" });
  }
  return { title: obj.title.trim() };
};

function jsonPost(body: unknown): Request {
  return new Request("http://x.test/api/todo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("request validation middleware", () => {
  it("validates and normalizes JSON into state", async () => {
    const handler = compose([withValidation(parseTodo)], async (c) => {
      const input = c.state.input as { title: string };
      return Response.json(input);
    });
    const res = await handler(ctxFor(jsonPost({ title: "  buy milk  " })));
    expect(await res.json()).toEqual({ title: "buy milk" });
  });

  it("throws ValidationError for invalid bodies", async () => {
    const handler = compose([withValidation(parseTodo)], async () =>
      Response.json({ ok: true }),
    );
    await expect(handler(ctxFor(jsonPost({})))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("validates query parameters", async () => {
    const handler = compose(
      [withValidation((q) => q as { page: string }, { target: "query" })],
      async (c) => Response.json(c.state.input ?? {}),
    );
    const res = await handler(
      ctxFor(new Request("http://x.test/api?page=2&tag=a&tag=b")),
    );
    expect(await res.json()).toEqual({ page: "2", tag: ["a", "b"] });
  });

  it("rejects malformed JSON", async () => {
    const handler = compose([withValidation(parseTodo)], async () =>
      Response.json({ ok: true }),
    );
    const bad = new Request("http://x.test/api/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    await expect(handler(ctxFor(bad))).rejects.toBeInstanceOf(ValidationError);
  });
});
