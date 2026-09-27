export const AUDIT_LOGGER_BINDING = "audit" as const;

/** Known action names; teams may extend with their own strings. */
export const AUDIT_ACTIONS = {
  authSignup: "auth.signup",
  authSignin: "auth.signin",
  authSignout: "auth.signout",
  authPasswordReset: "auth.password_reset",
  authSessionRevoked: "auth.session_revoked",
  dataCreated: "data.created",
  dataUpdated: "data.updated",
  dataDeleted: "data.deleted",
} as const;

export type AuditAction = string;

export type AuditOutcome = "success" | "failure";

export type AuditActor = {
  id?: string;
  ip?: string;
  userAgent?: string;
};

export type AuditEvent = {
  action: AuditAction;
  outcome: AuditOutcome;
  at: string;
  actor?: AuditActor;
  target?: { type: string; id?: string };
  metadata?: Record<string, unknown>;
};

export type AuditSink = (
  event: AuditEvent,
) => void | Promise<void>;
