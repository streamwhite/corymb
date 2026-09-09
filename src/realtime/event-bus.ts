/**
 * Fan-out bus for realtime events. Messages are opaque strings (typically
 * JSON). Implementations: in-memory (single instance / tests) and Redis
 * pub/sub (multi-instance fan-out via Bun's native RedisClient).
 */
export type EventBus = {
  publish: (channel: string, message: string) => Promise<void>;
  subscribe: (
    channel: string,
    handler: (message: string) => void,
  ) => Promise<() => Promise<void>>;
  close: () => Promise<void>;
};

export function createMemoryEventBus(): EventBus {
  const listeners = new Map<string, Set<(message: string) => void>>();
  return {
    async publish(channel, message) {
      for (const handler of listeners.get(channel) ?? []) {
        try {
          handler(message);
        } catch (err) {
          console.error("[events] handler failed:", err);
        }
      }
    },
    async subscribe(channel, handler) {
      const set = listeners.get(channel) ?? new Set();
      set.add(handler);
      listeners.set(channel, set);
      return async () => {
        set.delete(handler);
      };
    },
    async close() {
      listeners.clear();
    },
  };
}
