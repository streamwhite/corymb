import type { BetterAuthInstance } from "@/auth/better-auth.js";
import type { SensitiveVerifyStore } from "@/auth/sensitive-verify-store.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import {
  MSG_ACCESS_TOKEN_INVALID,
  MSG_INVALID_CREDENTIALS,
  MSG_INVALID_JSON,
  MSG_PASSWORD_NOT_SET,
  MSG_PASSWORD_REQUIRED,
} from "@/constants/messages.js";
import { jsonApiResponse } from "@/http/json-response.js";

const MS_PER_SECOND = 1000 as const;

export type SensitiveVerifyDeps = {
  auth: BetterAuthInstance;
  store: SensitiveVerifyStore;
  ttlSeconds: number;
  now?: () => number;
};

type ParsedPassword =
  | { ok: true; password: string }
  | { ok: false; reason: "json" | "missing" };

type PasswordCheck = "valid" | "invalid" | "missing";

/** Read the session from the server-side store, bypassing the cookie cache. */
export async function getAuthoritativeSession(
  auth: BetterAuthInstance,
  req: Request,
) {
  return auth.api.getSession({
    headers: req.headers,
    query: { disableCookieCache: true },
  });
}

async function parsePassword(req: Request): Promise<ParsedPassword> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, reason: "json" };
  }
  if (typeof body !== "object" || body === null) {
    return { ok: false, reason: "missing" };
  }
  const password = (body as { password?: unknown }).password;
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, reason: "missing" };
  }
  return { ok: true, password };
}

async function checkUserPassword(
  auth: BetterAuthInstance,
  userId: string,
  password: string,
): Promise<PasswordCheck> {
  const ctx = await auth.$context;
  const account = await ctx.internalAdapter.findCredentialAccount(userId);
  if (account?.password === undefined || account.password === null) {
    return "missing";
  }
  const valid = await ctx.password.verify({
    hash: account.password,
    password,
  });
  return valid ? "valid" : "invalid";
}

function passwordError(reason: "json" | "missing", url: URL): Response {
  const error = reason === "json" ? MSG_INVALID_JSON : MSG_PASSWORD_REQUIRED;
  return jsonApiResponse(
    { error },
    { status: HTTP_STATUS_BAD_REQUEST },
    url,
  );
}

/** Verify the current user's password and mark the session as recently verified. */
export async function handleSensitiveVerify(
  req: Request,
  deps: SensitiveVerifyDeps,
): Promise<Response> {
  const url = new URL(req.url);
  const session = await getAuthoritativeSession(deps.auth, req);
  if (session === null) {
    return jsonApiResponse(
      { error: MSG_ACCESS_TOKEN_INVALID },
      { status: HTTP_STATUS_UNAUTHORIZED },
      url,
    );
  }

  const parsed = await parsePassword(req);
  if (!parsed.ok) {
    return passwordError(parsed.reason, url);
  }

  const check = await checkUserPassword(
    deps.auth,
    session.user.id,
    parsed.password,
  );
  if (check === "missing") {
    return jsonApiResponse(
      { error: MSG_PASSWORD_NOT_SET },
      { status: HTTP_STATUS_BAD_REQUEST },
      url,
    );
  }
  if (check === "invalid") {
    return jsonApiResponse(
      { error: MSG_INVALID_CREDENTIALS },
      { status: HTTP_STATUS_BAD_REQUEST },
      url,
    );
  }

  await deps.store.mark(session.session.id);
  const now = (deps.now ?? Date.now)();
  return jsonApiResponse({
    verified: true as const,
    expiresAt: now + deps.ttlSeconds * MS_PER_SECOND,
  });
}
