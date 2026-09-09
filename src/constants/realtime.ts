/** Redis pub/sub channel every app instance broadcasts realtime events on. */
export const REALTIME_EVENTS_CHANNEL = "realtime:events" as const;

/** Initial event sent immediately after an SSE connection is established. */
export const SSE_READY_EVENT = "ready" as const;

/** Event name used for forwarded realtime payloads. */
export const SSE_MESSAGE_EVENT = "message" as const;

/** Client reconnect hint advertised to browsers (ms). */
export const SSE_RETRY_MS = 3000;

/** Comment-only keepalive frame interval (ms); defeats idle proxies. */
export const SSE_KEEPALIVE_INTERVAL_MS = 15_000;

/** Realtime event envelope published on the bus and streamed to clients. */
export type RealtimeEvent = {
  type: string;
  data?: unknown;
  at: number;
};
