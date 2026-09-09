import {
  REALTIME_EVENTS_CHANNEL,
  type RealtimeEvent,
} from "@/constants/realtime.js";
import type { EventBus } from "@/realtime/event-bus.js";

/** Publish a realtime event on the shared events channel. */
export async function publishRealtimeEvent(
  bus: EventBus,
  event: RealtimeEvent,
): Promise<void> {
  await bus.publish(REALTIME_EVENTS_CHANNEL, JSON.stringify(event));
}
