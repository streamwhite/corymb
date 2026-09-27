import { describe, expect, it } from "bun:test";
import type { AuditEvent } from "@/audit/audit-types.js";
import { withAudit } from "@/audit/audit-middleware.js";
import { createLogger } from "@/observability/logger.js";

const silentLogger = createLogger({}, { level: "error", writer: () => {} });

function recorder(events: AuditEvent[]) {
  return async (input: {
    action: string;
    outcome?: string;
    actor?: unknown;
    target?: unknown;
    metadata?: unknown;
  }) => {
    events.push({
      action: input.action,
      outcome: (input.outcome ?? "success") as AuditEvent["outcome"],
      at: new Date().toISOString(),
      actor: input.actor as AuditEvent["actor"],
      target: input.target as AuditEvent["target"],
      metadata: input.metadata as Record<string, unknown>,
    });
  };
}

const RULES = [{ path: "/api/pay", action: "payment.created", targetType: "payment" }];

describe("audit middleware", () => {
  it("records a success event for matching paths", async () => {
    const events: AuditEvent[] = [];
    const wrapped = withAudit(
      async () => Response.json({ ok: true }, { status: 201 }),
      { record: recorder(events), rules: RULES, logger: silentLogger },
    );
    const res = await wrapped(
      new Request("http://x.test/api/pay", {
        method: "POST",
        headers: { "X-Forwarded-For": "1.2.3.4", "User-Agent": "test-agent" },
      }),
    );
    expect(res.status).toBe(201);
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("payment.created");
    expect(events[0]?.outcome).toBe("success");
    expect(events[0]?.actor?.ip).toBe("1.2.3.4");
    expect(events[0]?.actor?.userAgent).toBe("test-agent");
    expect(events[0]?.target).toEqual({ type: "payment" });
  });

  it("records a failure event for error status", async () => {
    const events: AuditEvent[] = [];
    const wrapped = withAudit(
      async () => Response.json({ error: "nope" }, { status: 400 }),
      { record: recorder(events), rules: RULES, logger: silentLogger },
    );
    await wrapped(new Request("http://x.test/api/pay", { method: "POST" }));
    expect(events[0]?.outcome).toBe("failure");
    expect(events[0]?.metadata).toMatchObject({ status: 400 });
  });

  it("resolves the actor id and skips non-matching paths", async () => {
    const events: AuditEvent[] = [];
    const wrapped = withAudit(
      async () => Response.json({ ok: true }),
      {
        record: recorder(events),
        rules: RULES,
        logger: silentLogger,
        resolveActorId: () => "user-9",
      },
    );
    await wrapped(new Request("http://x.test/api/pay", { method: "POST" }));
    expect(events[0]?.actor?.id).toBe("user-9");

    await wrapped(new Request("http://x.test/api/other", { method: "POST" }));
    expect(events).toHaveLength(1);
  });

  it("never throws when the recorder fails", async () => {
    const wrapped = withAudit(async () => Response.json({ ok: true }), {
      record: async () => {
        throw new Error("audit down");
      },
      rules: RULES,
      logger: silentLogger,
    });
    const res = await wrapped(
      new Request("http://x.test/api/pay", { method: "POST" }),
    );
    expect(res.status).toBe(200);
  });
});
