import { UnauthorizedError } from "@/errors/app-error.js";
import { HEADER_AUTHORIZATION } from "@/constants/http-security.js";
import type { Middleware } from "@/middleware/middleware-types.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";

const BEARER_PREFIX = "Bearer " as const;

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
};

export type SessionInfo = {
  user: SessionUser;
  session: { id: string; token: string; expiresAt: Date | string };
};

export function bearerToken(req: Request): string | undefined {
  const header = req.headers.get(HEADER_AUTHORIZATION) ?? "";
  return header.startsWith(BEARER_PREFIX)
    ? header.slice(BEARER_PREFIX.length)
    : undefined;
}

async function loadSession(
  ctx: MiddlewareContext,
): Promise<SessionInfo | null> {
  const session = await ctx.auth.api.getSession({ headers: ctx.req.headers });
  if (session === null) {
    return null;
  }
  return session as unknown as SessionInfo;
}

/** Reads the current session without requiring one. */
export async function getOptionalSession(
  ctx: MiddlewareContext,
): Promise<SessionInfo | null> {
  return loadSession(ctx);
}

/**
 * Requires an authenticated session (cookie or bearer) and attaches it to
 * `ctx.state.session` / `ctx.state.user`. Throws `UnauthorizedError`.
 */
export function withSession(stateKey = "session"): Middleware {
  return async (ctx, next) => {
    const session = await loadSession(ctx);
    if (session === null) {
      throw new UnauthorizedError("Authentication required");
    }
    ctx.state[stateKey] = session;
    ctx.state.user = session.user;
    return next();
  };
}

export function readSession(ctx: MiddlewareContext): SessionInfo | undefined {
  return ctx.state.session as SessionInfo | undefined;
}

export function readUser(ctx: MiddlewareContext): SessionUser | undefined {
  return ctx.state.user as SessionUser | undefined;
}

/**
 * Resolves the actor id for audit/login from the session, without throwing.
 * Suitable for `createAuditLogger`-style integrations.
 */
export async function resolveActorId(
  ctx: MiddlewareContext,
): Promise<string | undefined> {
  const session = await loadSession(ctx);
  return session?.user.id;
}
