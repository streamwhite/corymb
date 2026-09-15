import { describe, expect, it } from "bun:test";
import * as pkg from "@/index.js";

describe("public package exports", () => {
  it("exports factory and server entry points", () => {
    expect(typeof pkg.createApp).toBe("function");
    expect(typeof pkg.startServer).toBe("function");
  });

  it("exports helpers consumers need to build features", () => {
    expect(typeof pkg.createMemoryCache).toBe("function");
    expect(typeof pkg.createMemoryEventBus).toBe("function");
    expect(typeof pkg.publishRealtimeEvent).toBe("function");
    expect(typeof pkg.withRateLimit).toBe("function");
    expect(pkg.HEALTH_BASE_PATH).toBe("/health");
    expect(pkg.REALTIME_EVENTS_BASE_PATH).toBe("/realtime/events");
    expect(pkg.REALTIME_EVENTS_CHANNEL).toBe("realtime:events");
  });
});
