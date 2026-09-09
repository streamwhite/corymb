import { SSE_RETRY_MS } from "@/constants/realtime.js";

export const SSE_CONTENT_TYPE = "text/event-stream" as const;

const ENCODER = new TextEncoder();

/** One SSE frame: `event` + `data`, terminated by a blank line. */
export function formatSseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

/** SSE keepalive / heartbeat comment frame. */
export function formatSseComment(text: string): string {
  return `: ${text}\n\n`;
}

export type SseStream = {
  response: Response;
  /** Send an event; no-op if the stream is not open or already closed. */
  send: (event: string, data: string) => void;
  /** Register cleanup invoked once when the stream closes or is cancelled. */
  onClose: (cleanup: () => void) => void;
};

/**
 * Build a streaming SSE Response. Writes a `retry:` hint, sends periodic
 * keepalive comments, and cleans up (interval + close callbacks) on cancel.
 * Frames sent before the stream opens are buffered.
 */
export function createSseStream(keepaliveMs: number): SseStream {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let pending: string[] = [];
  const closeCallbacks: Array<() => void> = [];

  function emit(frame: string): void {
    if (controller !== null) {
      controller.enqueue(ENCODER.encode(frame));
      return;
    }
    pending.push(frame);
  }

  function cleanup(): void {
    if (closed) return;
    closed = true;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    for (const callback of closeCallbacks) {
      try {
        callback();
      } catch (err) {
        console.error("[sse] close callback failed:", err);
      }
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      ctrl.enqueue(ENCODER.encode(`retry: ${SSE_RETRY_MS}\n`));
      for (const frame of pending) ctrl.enqueue(ENCODER.encode(frame));
      pending = [];
      timer = setInterval(() => {
        try {
          ctrl.enqueue(ENCODER.encode(formatSseComment("ping")));
        } catch {
          cleanup();
        }
      }, keepaliveMs);
    },
    cancel() {
      cleanup();
    },
  });

  return {
    response: new Response(stream, {
      headers: {
        "content-type": SSE_CONTENT_TYPE,
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    }),
    send(event, data) {
      if (closed) return;
      emit(formatSseEvent(event, data));
    },
    onClose(callback) {
      if (closed) {
        callback();
        return;
      }
      closeCallbacks.push(callback);
    },
  };
}
