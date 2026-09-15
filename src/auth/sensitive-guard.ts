import type { BetterAuthInstance } from "@/auth/better-auth.js";
import { getAuthoritativeSession } from "@/auth/sensitive-verify.js";
import type { SensitiveVerifyStore } from "@/auth/sensitive-verify-store.js";
import {
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import {
  MSG_ACCESS_TOKEN_INVALID,
  MSG_SENSITIVE_VERIFICATION_REQUIRED,
} from "@/constants/messages.js";
import { SENSITIVE_VERIFICATION_REQUIRED_CODE } from "@/constants/sensitive-auth.js";
import { jsonApiResponse } from "@/http/json-response.js";

const MS_PER_SECOND = 1000 as const;

export type SensitiveGuardDeps = {
  auth: BetterAuthInstance;
  store: SensitiveVerifyStore;
  freshAgeSeconds: number;
  now?: () => number;
};

export type SensitiveRouteHandler = (
  req: Request,
) => Response | Promise<Response>;

/** A session is fresh when it was created within `freshAgeSeconds` (non-positive disables the check). */
export function isSessionFresh(
  createdAtMs: number,
  freshAgeSeconds: number,
  nowMs: number,
): boolean {
  if (freshAgeSeconds <= 0) {
    return true;
  }
  return nowMs - createdAtMs < freshAgeSeconds * MS_PER_SECOND;
}

/**
 * Guard sensitive operations: allow when the session is fresh or was explicitly
 * re-authenticated recently; otherwise reject with 403.
 */
export async function requireSensitiveVerification(
  req: Request,
  deps: SensitiveGuardDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const session = await getAuthoritativeSession(deps.auth, req);
  if (session === null) {
    return jsonApiResponse(
      { error: MSG_ACCESS_TOKEN_INVALID },
      { status: HTTP_STATUS_UNAUTHORIZED },
      url,
    );
  }

  if (await deps.store.isVerified(session.session.id)) {
    return null;
  }

  const now = (deps.now ?? Date.now)();
  const createdAt = new Date(session.session.createdAt).getTime();
  if (isSessionFresh(createdAt, deps.freshAgeSeconds, now)) {
    return null;
  }

  return jsonApiResponse(
    {
      error: MSG_SENSITIVE_VERIFICATION_REQUIRED,
      code: SENSITIVE_VERIFICATION_REQUIRED_CODE,
    },
    { status: HTTP_STATUS_FORBIDDEN },
    url,
  );
}

/** Wrap a route handler so it only runs for fresh or recently verified sessions. */
export function withSensitiveOperation(
  deps: SensitiveGuardDeps,
  handler: SensitiveRouteHandler,
): SensitiveRouteHandler {
  return async (req: Request) => {
    const denied = await requireSensitiveVerification(req, deps);
    if (denied !== null) {
      return denied;
    }
    return handler(req);
  };
}
