import { describe, expect, it } from "bun:test";
import {
  CONTENT_TYPE_SSE,
  createSseResponse,
  createStreamResponse,
  formatSseEvent,
  streamFromIterable,
} from "@/http/streaming.js";

async function readAll(res: Response): Promise<string> {
  return new Response(res.body).text();
}

describe("streaming", () => {
  it("formats SSE events per wire format", () => {
    expect(
      formatSseEvent({ event: "message", id: "1", data: "hello" }),
    ).toBe("id: 1\nevent: message\ndata: hello\n\n");
    expect(formatSseEvent({ data: "a\nb" })).toBe("data: a\ndata: b\n\n");
  });

  it("streams chunks from an async iterable", async () => {
    async function* gen() {
      yield "a";
      yield new TextEncoder().encode("b");
      yield "c";
    }
    const res = streamFromIterable(gen());
    expect(await readAll(res)).toBe("abc");
  });

  it("creates an SSE response with headers", async () => {
    const res = createSseResponse((controller) => {
      controller.send({ data: "one" });
      controller.send({ data: "two" });
      controller.close();
    });
    expect(res.headers.get("Content-Type")).toBe(CONTENT_TYPE_SSE);
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    const text = await readAll(res);
    expect(text).toBe("data: one\n\ndata: two\n\n");
  });

  it("wraps an existing stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("streamed"));
        controller.close();
      },
    });
    const res = createStreamResponse(stream);
    expect(await readAll(res)).toBe("streamed");
  });
});
