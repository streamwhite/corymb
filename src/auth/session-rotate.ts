import { createCookieGetter } from "better-auth/cookies";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import {
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import { MSG_ACCESS_TOKEN_INVALID } from "@/constants/messages.js";
import { jsonApiResponse } from "@/http/json-response.js";

const SET_AUTH_TOKEN_HEADER = "set-auth-token" as const;

function serializeSessionCookie(
  name: string,
  token: string,
  attributes: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  },
): string {
  const parts = [`${name}=${encodeURIComponent(token)}`];
  if (attributes.maxAge !== undefined) {
    parts.push(`Max-Age=${String(attributes.maxAge)}`);
  }
  if (attributes.path !== undefined) {
    parts.push(`Path=${attributes.path}`);
  }
  if (attributes.httpOnly) {
    parts.push("HttpOnly");
  }
  if (attributes.secure) {
    parts.push("Secure");
  }
  if (attributes.sameSite !== undefined) {
    parts.push(`SameSite=${attributes.sameSite}`);
  }
  return parts.join("; ");
}

export async function handleSessionRotate(
  req: Request,
  auth: BetterAuthInstance,
): Promise<Response> {
  const headers = req.headers;
  const current = await auth.api.getSession({ headers });
  if (current === null) {
    return jsonApiResponse(
      { error: MSG_ACCESS_TOKEN_INVALID },
      { status: HTTP_STATUS_UNAUTHORIZED },
      new URL(req.url),
    );
  }

  const oldToken = current.session.token;
  const userId = current.user.id;
  const ctx = await auth.$context;

  await ctx.internalAdapter.deleteSession(oldToken);
  const created = await ctx.internalAdapter.createSession(userId);
  if (!created) {
    return jsonApiResponse(
      { error: MSG_ACCESS_TOKEN_INVALID },
      { status: HTTP_STATUS_UNAUTHORIZED },
      new URL(req.url),
    );
  }

  const getCookie = createCookieGetter(ctx.options);
  const sessionCookie = getCookie("session_token");
  const maxAgeSeconds = Math.max(
    1,
    Math.floor((new Date(created.expiresAt).getTime() - Date.now()) / 1000),
  );
  const setCookie = serializeSessionCookie(sessionCookie.name, created.token, {
    ...sessionCookie.attributes,
    maxAge: maxAgeSeconds,
  });

  const body = {
    ok: true as const,
    session: {
      token: created.token,
      expiresAt: created.expiresAt,
    },
    user: {
      id: current.user.id,
      email: current.user.email,
      name: current.user.name,
      username: (current.user as { username?: string | null }).username ?? null,
    },
  };

  return new Response(JSON.stringify(body), {
    status: HTTP_STATUS_OK,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": setCookie,
      [SET_AUTH_TOKEN_HEADER]: created.token,
    },
  });
}
