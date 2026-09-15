import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createApp } from "@/app.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { REALTIME_EVENTS_CHANNEL } from "@/constants/realtime.js";
import { HEALTH_BASE_PATH } from "@/constants/routes.js";
import { createMemoryEventBus } from "@/realtime/event-bus.js";
import { publishRealtimeEvent } from "@/realtime/publish.js";
import { createMemoryApp } from "./helpers/app-memory.js";

const TEST_AUTH_SECRET = "test-better-auth-secret-at-least-32-chars!!";

describe("createApp route merge + events", () => {
  it("serves custom routes and keeps built-in /health", async () => {
    const { app } = await createMemoryApp({
      routes: {
        "/api/hello": {
          GET: () => Response.json({ ok: true }),
        },
      },
    });

    const health = await app.request(HEALTH_BASE_PATH);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const hello = await app.request("/api/hello");
    expect(hello.status).toBe(200);
    expect(await hello.json()).toEqual({ ok: true });
  });

  it("lets consumer routes override built-in paths", async () => {
    const { app } = await createMemoryApp({
      routes: {
        [HEALTH_BASE_PATH]: {
          GET: () => Response.json({ status: "custom" }),
        },
      },
    });

    const health = await app.request(HEALTH_BASE_PATH);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "custom" });
  });

  it("exposes events on AppInstance and publishRealtimeEvent works", async () => {
    const bus = createMemoryEventBus();
    const messages: string[] = [];
    await bus.subscribe(REALTIME_EVENTS_CHANNEL, (message) => {
      messages.push(message);
    });

    const dir = mkdtempSync(join(tmpdir(), "ba-events-"));
    const instance = await createApp({
      databasePath: join(dir, "test.sqlite"),
      cache: createMemoryCache(),
      authSecret: TEST_AUTH_SECRET,
      authBaseURL: "http://127.0.0.1",
      authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
      events: bus,
    });
    try {
      expect(instance.events).toBe(bus);
      await publishRealtimeEvent(instance.events, {
        type: "widget.created",
        data: { id: "1" },
        at: 1,
      });
      expect(messages).toHaveLength(1);
      expect(JSON.parse(messages[0]!)).toEqual({
        type: "widget.created",
        data: { id: "1" },
        at: 1,
      });
    } finally {
      await instance.close();
    }
  });
});
