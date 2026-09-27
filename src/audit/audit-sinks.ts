import { mkdirSync, appendFileSync } from "fs";
import path from "path";
import type { AuditEvent, AuditSink } from "@/audit/audit-types.js";

/** Append-only JSONL audit sink. Ensure the directory exists first. */
export function createFileAuditSink(filePath: string): AuditSink {
  mkdirSync(path.dirname(filePath), { recursive: true });
  return (event: AuditEvent) => {
    appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
  };
}

/** In-memory audit sink for tests and local development. */
export function createMemoryAuditSink(): AuditSink & { events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  const sink = ((event: AuditEvent) => {
    events.push(event);
  }) as AuditSink & { events: AuditEvent[] };
  sink.events = events;
  return sink;
}
