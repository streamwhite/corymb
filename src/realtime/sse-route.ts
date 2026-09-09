import type { BetterAuthInstance } from "@/auth/better-auth.js";
import {
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import {
  REALTIME_EVENTS_CHANNEL,
  SSE_KEEPALIVE_INTERVAL_MS,
  SSE_MESSAGE_EVENT,
  SSE_READY_EVENT,
  SSE_RETRY_MS,
} from "@/constants/realtime.js";
import { MSG_ACCESS_TOKEN_INVALID } from "@/constants/messages.js";
import { jsonApiResponse } from "@/http/json-response.js";
import type { EventBus } from "@/realtime/event-bus.js";
import { createSseStream } from "@/realtime/sse.js";

export type RealtimeEventsDeps = {
  auth: BetterAuthInstance;
  bus: EventBus;
};

async function resolveSession(
  req: Request,
  auth: BetterAuthInstance,
): Promise<boolean> {
  try {
    return (await auth.api.getSession({ headers: req.headers })) !== null;
  } catch (err) {
    console.error("[events] session check failed:", err);
    return false;
  }
}

/** Long-lived `GET` handler streaming published realtime events as SSE. */
export function createRealtimeEventsHandler(deps: RealtimeEventsDeps) {
  return async function handleRealtimeEvents(
    req: Request,
  ): Promise<Response> {
    if (!(await resolveSession(req, deps.auth))) {
      return jsonApiResponse(
        { error: MSG_ACCESS_TOKEN_INVALID },
        { status: HTTP_STATUS_UNAUTHORIZED },
        new URL(req.url),
      );
    }
    const sse = createSseStream(SSE_KEEPALIVE_INTERVAL_MS);
    sse.send(
      SSE_READY_EVENT,
      JSON.stringify({ channel: REALTIME_EVENTS_CHANNEL, retry: SSE_RETRY_MS }),
    );
    const unsubscribe = await deps.bus.subscribe(
      REALTIME_EVENTS_CHANNEL,
      (message) => {
        sse.send(SSE_MESSAGE_EVENT, message);
      },
    );
    sse.onClose(() => {
      void unsubscribe().catch((err: unknown) =>
        console.error("[events] unsubscribe failed:", err),
      );
    });
    return sse.response;
  };
}
