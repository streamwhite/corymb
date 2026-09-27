import { describe, expect, it } from "bun:test";
import { createGracefulShutdown } from "@/server/graceful-shutdown.js";
import { createLogger } from "@/observability/logger.js";

const silentLogger = createLogger({}, { level: "error", writer: () => {} });

describe("graceful shutdown", () => {
  it("runs steps in order", async () => {
    const order: string[] = [];
    const shutdown = createGracefulShutdown({
      logger: silentLogger,
      steps: [
        { name: "server", run: () => void order.push("server") },
        { name: "tasks", run: async () => void order.push("tasks") },
        { name: "db", run: () => void order.push("db") },
      ],
    });
    await shutdown.shutdown("test");
    expect(order).toEqual(["server", "tasks", "db"]);
  });

  it("is idempotent", async () => {
    let runs = 0;
    const shutdown = createGracefulShutdown({
      logger: silentLogger,
      steps: [{ name: "once", run: () => void (runs += 1) }],
    });
    await Promise.all([
      shutdown.shutdown(),
      shutdown.shutdown(),
      shutdown.shutdown(),
    ]);
    expect(runs).toBe(1);
    expect(shutdown.isShuttingDown()).toBe(true);
  });

  it("continues after a failing step and reports it", async () => {
    const order: string[] = [];
    const shutdown = createGracefulShutdown({
      logger: silentLogger,
      steps: [
        {
          name: "bad",
          run: () => {
            throw new Error("boom");
          },
        },
        { name: "after", run: () => void order.push("after") },
      ],
    });
    await shutdown.shutdown();
    expect(order).toEqual(["after"]);
  });
});
