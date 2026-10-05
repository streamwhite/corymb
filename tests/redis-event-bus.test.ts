import { afterAll, describe, expect, it } from "bun:test";
import {
  createDefaultEventBus,
  createRedisEventBus,
} from "@/realtime/redis-event-bus.js";
import {
  REDIS_AVAILABLE,
  getTestRedisUrl,
  stopTestRedis,
} from "./helpers/test-redis.js";

const UNREACHABLE_REDIS_URL = "redis://127.0.0.1:1" as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(20);
  }
  if (!predicate()) {
    throw new Error("condition not met before timeout");
  }
}

afterAll(async () => {
  await stopTestRedis();
});

describe("default event bus fallback", () => {
  it("falls back to the in-memory bus when Redis is unreachable", async () => {
    const { bus, redis } = await createDefaultEventBus({
      url: UNREACHABLE_REDIS_URL,
    });
    expect(redis).toBe(false);
    const seen: string[] = [];
    const unsubscribe = await bus.subscribe("topic", (message) =>
      seen.push(message),
    );
    await bus.publish("topic", "hello");
    expect(seen).toEqual(["hello"]);
    await unsubscribe();
    await bus.close();
  });
});

describe.skipIf(!REDIS_AVAILABLE)("redis event bus", () => {
  it("fans a published message out to subscribers on another bus", async () => {
    const url = await getTestRedisUrl();
    const publisher = await createRedisEventBus({ url });
    const consumer = await createRedisEventBus({ url });
    const channel = `events-${crypto.randomUUID()}`;
    const seen: string[] = [];
    try {
      const unsubscribe = await consumer.subscribe(channel, (message) =>
        seen.push(message),
      );
      await publisher.publish(channel, "payload");
      await waitFor(() => seen.length === 1);
      expect(seen).toEqual(["payload"]);
      await unsubscribe();
    } finally {
      await publisher.close();
      await consumer.close();
    }
  });

  it("stops delivering after unsubscribe and keeps other handlers alive", async () => {
    const url = await getTestRedisUrl();
    const publisher = await createRedisEventBus({ url });
    const consumer = await createRedisEventBus({ url });
    const channel = `events-${crypto.randomUUID()}`;
    const first: string[] = [];
    const second: string[] = [];
    const originalError = console.error;
    console.error = () => {};
    try {
      const unsubscribeFirst = await consumer.subscribe(channel, (message) => {
        first.push(message);
        throw new Error("handler blew up");
      });
      const unsubscribeSecond = await consumer.subscribe(channel, (message) =>
        second.push(message),
      );
      await publisher.publish(channel, "one");
      await waitFor(() => first.length === 1 && second.length === 1);

      await unsubscribeFirst();
      await publisher.publish(channel, "two");
      await waitFor(() => second.length === 2);
      await sleep(50);
      expect(first).toEqual(["one"]);
      expect(second).toEqual(["one", "two"]);
      await unsubscribeSecond();
    } finally {
      console.error = originalError;
      await publisher.close();
      await consumer.close();
    }
  });

  it("reports redis backing when reachable", async () => {
    const url = await getTestRedisUrl();
    const { bus, redis } = await createDefaultEventBus({ url });
    expect(redis).toBe(true);
    await bus.close();
  });
});
