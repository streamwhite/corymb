export const CONTENT_TYPE_SSE = "text/event-stream; charset=utf-8" as const;

export const HEADER_CACHE_CONTROL = "Cache-Control" as const;

export const HEADER_CONNECTION = "Connection" as const;

export const CACHE_CONTROL_NO_CACHE = "no-cache, no-transform" as const;

export const CONNECTION_KEEP_ALIVE = "keep-alive" as const;

export type SseEvent = {
  event?: string;
  data: string;
  id?: string;
  retryMs?: number;
};

/** Serializes one SSE event per the text/event-stream format. */
export function formatSseEvent(event: SseEvent): string {
  const lines: string[] = [];
  if (event.id !== undefined) lines.push(`id: ${event.id}`);
  if (event.event !== undefined) lines.push(`event: ${event.event}`);
  if (event.retryMs !== undefined) lines.push(`retry: ${String(event.retryMs)}`);
  for (const line of event.data.split("\n")) {
    lines.push(`data: ${line}`);
  }
  return `${lines.join("\n")}\n\n`;
}

/** Response whose stream you control via the returned writer. */
export function createStreamResponse(
  stream: ReadableStream<Uint8Array>,
  init?: ResponseInit,
): Response {
  return new Response(stream, init);
}

export type SseController = {
  response: Response;
  send: (event: SseEvent) => void;
  close: () => void;
};

function sseHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Content-Type", CONTENT_TYPE_SSE);
  headers.set(HEADER_CACHE_CONTROL, CACHE_CONTROL_NO_CACHE);
  headers.set(HEADER_CONNECTION, CONNECTION_KEEP_ALIVE);
  return headers;
}

/**
 * Creates an SSE response plus an imperative `send`/`close` handle. The caller
 * owns lifecycle (e.g. subscribe to an event bus and call `send`).
 */
export function createSseResponse(
  start: (controller: SseController) => void | (() => void),
  init?: { headers?: HeadersInit },
): Response {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | void;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      cleanup = start({
        response: undefined as unknown as Response,
        send: (event: SseEvent) => {
          controller.enqueue(encoder.encode(formatSseEvent(event)));
        },
        close,
      });
    },
    cancel() {
      cleanup?.();
    },
  });
  return createStreamResponse(stream, { headers: sseHeaders(init?.headers) });
}

/** Streams an async iterable of strings/chunks as a response body. */
export function streamFromIterable(
  chunks: AsyncIterable<string | Uint8Array>,
  init?: ResponseInit,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          controller.enqueue(
            typeof chunk === "string" ? encoder.encode(chunk) : chunk,
          );
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  return createStreamResponse(stream, init);
}
