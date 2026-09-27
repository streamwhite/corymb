import { describe, expect, it } from "bun:test";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { createRateLimiter } from "@/http/rate-limit.js";
import { createMemoryEventBus } from "@/realtime/event-bus.js";
import { startServer } from "@/server/start-server.js";
import { createMemoryStorage } from "@/storage/memory-storage.js";
import { createNoopTaskQueue } from "@/tasks/task-queue.js";
import type { WebSocketConnection } from "@/websocket/websocket.js";
import {
  createTestDatabase,
  dropTestDatabase,
  PG_AVAILABLE,
} from "./helpers/test-db.js";

const TEST_AUTH_SECRET = "test-better-auth-secret-at-least-32-chars!!";

function waitForMessage(
  ws: WebSocket,
  timeoutMs = 3000,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ws message timeout")), timeoutMs);
    ws.addEventListener(
      "message",
      (event) => {
        clearTimeout(timer);
        resolve(typeof event.data === "string" ? event.data : null);
      },
      { once: true },
    );
  });
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener("error", () => reject(new Error("ws open failed")), {
      once: true,
    });
  });
}

describe.skipIf(!PG_AVAILABLE)("websocket integration", () => {
  it("echoes messages and broadcasts within a topic", async () => {
    const pgUrl = await createTestDatabase();
    const seen: string[] = [];
    const { server, app, url } = await startServer({
      databaseConfig: { pgUrl },
      cache: createMemoryCache(),
      rateLimiter: createRateLimiter(),
      taskQueueInstance: createNoopTaskQueue(),
      storage: createMemoryStorage(),
      events: createMemoryEventBus(),
      authSecret: TEST_AUTH_SECRET,
      authBaseURL: "http://127.0.0.1",
      authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
      port: 0,
      hostname: "127.0.0.1",
      websocket: [
        {
          path: "/ws/echo",
          open(ws: WebSocketConnection) {
            ws.subscribe("room");
            ws.send(JSON.stringify({ type: "ready" }));
          },
          message(ws: WebSocketConnection, message: string | Buffer) {
            const text = typeof message === "string" ? message : message.toString();
            seen.push(text);
            ws.publish("room", text);
          },
        },
      ],
    });
    const wsUrl = url.href.replace(/^http/, "ws");
    try {
      const a = await openSocket(`${wsUrl}ws/echo`);
      expect(JSON.parse((await waitForMessage(a)) ?? "{}")).toEqual({
        type: "ready",
      });
      const b = await openSocket(`${wsUrl}ws/echo`);
      await waitForMessage(b); // ready

      a.send("hello");
      expect(await waitForMessage(b)).toBe("hello");
      expect(seen).toEqual(["hello"]);

      a.close();
      b.close();
    } finally {
      await server.stop(true);
      await app.close();
      await dropTestDatabase(pgUrl);
    }
  });

  it("rejects upgrade when authorize returns false", async () => {
    const pgUrl = await createTestDatabase();
    const { server, app, url } = await startServer({
      databaseConfig: { pgUrl },
      cache: createMemoryCache(),
      rateLimiter: createRateLimiter(),
      taskQueueInstance: createNoopTaskQueue(),
      storage: createMemoryStorage(),
      events: createMemoryEventBus(),
      authSecret: TEST_AUTH_SECRET,
      authBaseURL: "http://127.0.0.1",
      authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
      port: 0,
      hostname: "127.0.0.1",
      websocket: [
        {
          path: "/ws/private",
          authorize: () => false,
          message() {},
        },
      ],
    });
    const wsUrl = url.href.replace(/^http/, "ws");
    try {
      await expect(openSocket(`${wsUrl}ws/private`)).rejects.toThrow();
    } finally {
      await server.stop(true);
      await app.close();
      await dropTestDatabase(pgUrl);
    }
  });
});
