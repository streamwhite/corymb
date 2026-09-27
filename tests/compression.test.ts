import { describe, expect, it } from "bun:test";
import { withCompression } from "@/middleware/builtin/compression.js";
import { compose } from "@/middleware/compose.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import { createLogger } from "@/observability/logger.js";

function ctx(headers?: HeadersInit): MiddlewareContext {
  const req = new Request("http://x.test", { headers });
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

const bigJson = () => Response.json({ data: "x".repeat(4096) });

describe("compression middleware", () => {
  it("gzip-compresses a large JSON response when accepted", async () => {
    const handler = compose([withCompression()], async () => bigJson());
    const res = await handler(ctx({ "Accept-Encoding": "gzip" }));
    expect(res.headers.get("Content-Encoding")).toBe("gzip");
    expect(res.headers.get("Vary")).toContain("Accept-Encoding");
    const raw = new Uint8Array(await res.arrayBuffer());
    const decoded = Bun.gunzipSync(raw);
    expect(JSON.parse(new TextDecoder().decode(decoded))).toHaveProperty("data");
  });

  it("prefers brotli when offered", async () => {
    const handler = compose([withCompression()], async () => bigJson());
    const res = await handler(ctx({ "Accept-Encoding": "br, gzip" }));
    expect(res.headers.get("Content-Encoding")).toBe("br");
  });

  it("leaves small bodies uncompressed", async () => {
    const handler = compose([withCompression()], async () =>
      Response.json({ ok: true }),
    );
    const res = await handler(ctx({ "Accept-Encoding": "gzip" }));
    expect(res.headers.get("Content-Encoding")).toBeNull();
  });

  it("does not compress when the client does not accept it", async () => {
    const handler = compose([withCompression()], async () => bigJson());
    const res = await handler(ctx());
    expect(res.headers.get("Content-Encoding")).toBeNull();
  });

  it("skips event-stream responses", async () => {
    const handler = compose([withCompression()], async () =>
      new Response("data: hello\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const res = await handler(ctx({ "Accept-Encoding": "gzip" }));
    expect(res.headers.get("Content-Encoding")).toBeNull();
  });

  it("skips binary content", async () => {
    const handler = compose([withCompression()], async () =>
      new Response(new Uint8Array(8192), {
        headers: { "Content-Type": "image/png" },
      }),
    );
    const res = await handler(ctx({ "Accept-Encoding": "gzip" }));
    expect(res.headers.get("Content-Encoding")).toBeNull();
  });
});
