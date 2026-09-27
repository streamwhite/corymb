import type { AuditActor, AuditSink } from "@/audit/audit-types.js";
import type { RecordAuditInput } from "@/audit/audit-logger.js";
import { HEADER_USER_AGENT } from "@/constants/http-security.js";
import { HTTP_STATUS_INTERNAL } from "@/constants/http-status.js";

export type AuditRecorder = (input: RecordAuditInput) => Promise<void>;

export type AuditRule = {
  /** Path prefix this rule applies to. */
  path: string;
  /** Action recorded for matching requests. */
  action: string;
  /** Target type recorded with the event. */
  targetType?: string;
};

export type AuditMiddlewareOptions = {
  record: AuditRecorder;
  rules: AuditRule[];
  /** Resolves the actor id (e.g. from a session) for the request. */
  resolveActorId?: (req: Request) => string | undefined | Promise<string | undefined>;
  logger: { error: (message: string, fields?: Record<string, unknown>) => void };
};

const HEADER_FORWARDED_FOR = "x-forwarded-for" as const;
const HEADER_REAL_IP = "x-real-ip" as const;
const FIRST_HOP_INDEX = 0;

function actorFromRequest(
  req: Request,
  id?: string,
): AuditActor {
  const forwarded = req.headers.get(HEADER_FORWARDED_FOR);
  const realIp = req.headers.get(HEADER_REAL_IP);
  const ip =
    forwarded?.split(",")[FIRST_HOP_INDEX]?.trim() ??
    realIp ??
    undefined;
  return {
    ...(id === undefined ? {} : { id }),
    ...(ip === undefined || ip.length === 0 ? {} : { ip }),
    ...(req.headers.get(HEADER_USER_AGENT) === null
      ? {}
      : { userAgent: req.headers.get(HEADER_USER_AGENT) ?? undefined }),
  };
}

function matchRule(pathname: string, rules: AuditRule[]): AuditRule | undefined {
  return rules.find((rule) => pathname.startsWith(rule.path));
}

/**
 * Wraps a handler and records an audit event for matching paths. Success is
 * inferred from the status code (2xx/3xx success, else failure). Audit failures
 * are logged and never affect the response.
 */
export function withAudit<H extends (req: Request) => Promise<Response>>(
  handler: H,
  options: AuditMiddlewareOptions,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const url = new URL(req.url);
    const rule = matchRule(url.pathname, options.rules);
    if (rule === undefined) {
      return handler(req);
    }
    const actorId = await options.resolveActorId?.(req);
    let res: Response;
    try {
      res = await handler(req);
    } catch (err) {
      await safeRecord(options, {
        action: rule.action,
        outcome: "failure",
        actor: actorFromRequest(req, actorId),
        target: { type: rule.targetType ?? "route" },
        metadata: { path: url.pathname, error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
    const outcome = res.status < HTTP_STATUS_INTERNAL && res.status < 400 ? "success" : "failure";
    await safeRecord(options, {
      action: rule.action,
      outcome,
      actor: actorFromRequest(req, actorId),
      target: { type: rule.targetType ?? "route" },
      metadata: { path: url.pathname, method: req.method, status: res.status },
    });
    return res;
  };
}

async function safeRecord(
  options: AuditMiddlewareOptions,
  input: RecordAuditInput,
): Promise<void> {
  try {
    await options.record(input);
  } catch (err) {
    options.logger.error("audit middleware failed", {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Sink that forwards audit events into the task queue for durable processing. */
export function createQueueAuditSink(
  enqueue: (action: string, payload: unknown) => Promise<unknown>,
): AuditSink {
  return async (event) => {
    await enqueue("audit.persist", event);
  };
}
