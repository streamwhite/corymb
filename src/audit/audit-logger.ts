import {
  AUDIT_LOGGER_BINDING,
  type AuditActor,
  type AuditEvent,
  type AuditOutcome,
  type AuditSink,
} from "@/audit/audit-types.js";
import type { Logger } from "@/observability/logger.js";

export type RecordAuditInput = {
  action: string;
  outcome?: AuditOutcome;
  actor?: AuditActor;
  target?: { type: string; id?: string };
  metadata?: Record<string, unknown>;
};

const DEFAULT_OUTCOME: AuditOutcome = "success";

/** Structured-log sink: one audit line per event via the framework logger. */
export function createLoggerAuditSink(logger: Logger): AuditSink {
  const auditLog = logger.child({ [AUDIT_LOGGER_BINDING]: true });
  return (event) => {
    auditLog.info(event.action, { ...event });
  };
}

function toActorFields(actor: AuditActor | undefined): Record<string, unknown> {
  return actor === undefined ? {} : { actor };
}

export type CreateAuditLoggerOptions = {
  logger: Logger;
  /** Extra sinks (durable stores, SIEM, PostgREST table). */
  sinks?: AuditSink[];
};

/**
 * Fan-out audit logger. Static sinks plus the structured-log sink receive every
 * event; sink failures are logged and never break the request path.
 */
export function createAuditLogger(options: CreateAuditLoggerOptions): {
  record: (input: RecordAuditInput) => Promise<void>;
} {
  const sinks: AuditSink[] = [
    createLoggerAuditSink(options.logger),
    ...(options.sinks ?? []),
  ];

  async function record(input: RecordAuditInput): Promise<void> {
    const event: AuditEvent = {
      action: input.action,
      outcome: input.outcome ?? DEFAULT_OUTCOME,
      at: new Date().toISOString(),
      ...toActorFields(input.actor),
      ...(input.target === undefined ? {} : { target: input.target }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    };
    await Promise.all(
      sinks.map(async (sink) => {
        try {
          await sink(event);
        } catch (err) {
          options.logger.error("audit sink failed", {
            action: event.action,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );
  }

  return { record };
}
