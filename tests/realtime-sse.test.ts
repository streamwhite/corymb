import { describe, expect, it } from "bun:test";
import { RedisClient } from "bun";
import {
  REALTIME_EVENTS_CHANNEL,
  SSE_MESSAGE_EVENT,
  SSE_READY_EVENT,
} from "@/constants/realtime.js";
import { REALTIME_EVENTS_BASE_PATH } from "@/constants/routes.js";
import {
  createMemoryEventBus,
  type EventBus,
} from "@/realtime/event-bus.js";
import { formatSseEvent } from "@/realtime/sse.js";
import { publishRealtimeEvent } from "@/realtime/publish.js";
import { createRedisEventBus } from "@/realtime/redis-event-bus.js";
import { ENV_REDIS_URL } from "@/constants/redis.js";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import { VALID_TEST_USERNAME } from "./constants.js";
import { signupUser } from "./helpers/auth-flow.js";
import { createMemoryApp } from "./helpers/app-memory.js";

const VALID_TEST_PASSWORD = "x".repeat(MIN_PASSWORD_LENGTH);


type TestEvent = { type: string; at: number };

describe("memory event bus", () => {
  it("delivers published messages to subscribers", async () => {
    const bus = createMemoryEventBus();
    const received: string[] = [];
    const off = await bus.subscribe(REALTIME_EVENTS_CHANNEL, (message) => {
      received.push(message);
    });
    await publishRealtimeEvent(bus, { type: "ping", at: 1 });
    expect(received).toEqual([JSON.stringify({ type: "ping", at: 1 })]);
    await off();
    await bus.close();
  });

  it("stops delivering after unsubscribe", async () => {
    const bus = createMemoryEventBus();
    const received: string[] = [];
    const off = await bus.subscribe(REALTIME_EVENTS_CHANNEL, (message) => {
      received.push(message);
    });
    await off();
    await bus.publish(REALTIME_EVENTS_CHANNEL, "ignored");
    expect(received).toEqual([]);
    await bus.close();
  });

  it("publishes to no one when there are no subscribers", async () => {
    const bus = createMemoryEventBus();
    await expect(
      bus.publish(REALTIME_EVENTS_CHANNEL, "orphan"),
    ).resolves.toBeUndefined();
    await bus.close();
  });
});

describe("sse formatting", () => {
  it("formats event/data pairs per the SSE wire format", () => {
    const frame = formatSseEvent(SSE_MESSAGE_EVENT, "{\"a\":1}");
    expect(frame).toBe("event: message\ndata: {\"a\":1}\n\n");
  });
});

describe("realtime sse route", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const bus: EventBus = createMemoryEventBus();
    const { app } = await createMemoryApp({ events: bus });
    const res = await app.request(REALTIME_EVENTS_BASE_PATH);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    await bus.close();
  });

  it("streams ready then published events for an authenticated session", async () => {
    const bus: EventBus = createMemoryEventBus();
    const { app } = await createMemoryApp({ events: bus });
    const signup = await signupUser(app.request, {
      email: "sse-auth@example.com",
      username: VALID_TEST_USERNAME,
      password: VALID_TEST_PASSWORD,
    });
    expect(signup.status).toBe(200);

    const cookieJar = { value: signup.cookies };
    const res = await app.requestWithCookies(
      REALTIME_EVENTS_BASE_PATH,
      undefined,
      cookieJar,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");

    const reader = res.body!.getReader()!;
    const decoder = new TextDecoder();
    let collected = "";
    const readLoop = (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          collected += decoder.decode(value, { stream: true });
          if (collected.includes("published-auth-e2e")) break;
        }
      } catch {
        // stream cancelled
      }
    })();

    await publishRealtimeEvent(bus, {
      type: "test",
      at: 0,
    } satisfies TestEvent);
    await bus.publish(
      REALTIME_EVENTS_CHANNEL,
      JSON.stringify({ marker: "published-auth-e2e" }),
    );
    await readLoop;

    expect(collected).toContain(`event: ${SSE_READY_EVENT}`);
    expect(collected).toContain(`event: ${SSE_MESSAGE_EVENT}`);
    expect(collected).toContain("published-auth-e2e");

    await reader.cancel().catch(() => {});
    await bus.close();
  });
});

const redisUrl = process.env[ENV_REDIS_URL];

async function redisAvailable(url: string): Promise<boolean> {
  const probe = new RedisClient(url, { connectionTimeout: 500 });
  try {
    return await Promise.race([
      probe.send("PING", []).then((r: unknown) => r === "PONG"),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), PROBE_TIMEOUT_MS),
      ),
    ]);
  } catch {
    return false;
  } finally {
    probe.close();
  }
}

const PROBE_TIMEOUT_MS = 1000;

const redisReady = redisUrl !== undefined && (await redisAvailable(redisUrl));

describe.skipIf(!redisReady)("redis event bus integration", () => {
  it("delivers messages across separate bus instances (pub/sub)", async () => {
    const publisherBus = await createRedisEventBus({ url: redisUrl as string });
    const subscriberBus = await createRedisEventBus({ url: redisUrl as string });
    const received: string[] = [];
    const off = await subscriberBus.subscribe(
      REALTIME_EVENTS_CHANNEL,
      (message) => received.push(message),
    );
    // Allow the Redis SUBSCRIBE to be fully registered before publishing.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await publisherBus.publish(
      REALTIME_EVENTS_CHANNEL,
      JSON.stringify({ type: "cross", at: 1 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(received).toEqual([JSON.stringify({ type: "cross", at: 1 })]);
    await off();
    await publisherBus.close();
    await subscriberBus.close();
  });
});
