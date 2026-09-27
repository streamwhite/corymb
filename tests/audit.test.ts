import { describe, expect, it } from "bun:test";
import {
  createAuditLogger,
  createLoggerAuditSink,
} from "@/audit/audit-logger.js";
import { createMemoryAuditSink } from "@/audit/audit-sinks.js";
import { AUDIT_LOGGER_BINDING } from "@/audit/audit-types.js";
import { createLogger } from "@/observability/logger.js";

function captureLogger(lines: string[]) {
  return createLogger(
    { service: "test" },
    { level: "debug", writer: (_level, line) => lines.push(line) },
  );
}

describe("audit logger", () => {
  it("fans out to the log sink and extra sinks", async () => {
    const lines: string[] = [];
    const memory = createMemoryAuditSink();
    const audit = createAuditLogger({
      logger: captureLogger(lines),
      sinks: [memory],
    });

    await audit.record({
      action: "auth.signin",
      actor: { id: "u1", ip: "127.0.0.1" },
      metadata: { method: "password" },
    });

    expect(memory.events).toHaveLength(1);
    expect(memory.events[0]?.action).toBe("auth.signin");
    expect(memory.events[0]?.outcome).toBe("success");
    expect(typeof memory.events[0]?.at).toBe("string");

    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(parsed[AUDIT_LOGGER_BINDING]).toBe(true);
    expect(parsed.action).toBe("auth.signin");
  });

  it("marks failures and never throws when a sink fails", async () => {
    const memory = createMemoryAuditSink();
    const audit = createAuditLogger({
      logger: createLogger({}, { level: "error", writer: () => {} }),
      sinks: [
        () => {
          throw new Error("sink down");
        },
        memory,
      ],
    });
    await audit.record({ action: "data.deleted", outcome: "failure" });
    expect(memory.events[0]?.outcome).toBe("failure");
  });

  it("exposes a standalone log sink", async () => {
    const lines: string[] = [];
    const sink = createLoggerAuditSink(captureLogger(lines));
    await sink({ action: "custom", outcome: "success", at: new Date().toISOString() });
    expect(lines).toHaveLength(1);
  });
});
