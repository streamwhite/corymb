import type { SQL } from "bun";
import { consumeAuthToken } from "@/auth/auth-tokens.js";
import { findUserById } from "@/auth/user-queries.js";
import { revokeAllSessionsForUser } from "@/auth/session.js";
import type { Cache } from "@/cache/cache-types.js";
import { invalidateUser } from "@/cache/invalidate.js";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import { PASSWORD_RESETS_TABLE } from "@/constants/auth-tokens.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import {
  MSG_AUTH_TOKEN_INVALID,
  MSG_PASSWORD_TOO_SHORT,
  MSG_RESET_PASSWORD_REQUIRED,
} from "@/constants/messages.js";
import { bcryptHashOptions } from "@/constants/password-hash.js";
import { readJsonUnknown } from "@/http/json-body.js";
import { jsonApiResponse } from "@/http/json-response.js";

type ResetPayload = {
  token: string;
  password: string;
};

function pickResetPayload(value: unknown): ResetPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const obj = value as { token?: unknown; password?: unknown };
  if (typeof obj.token !== "string" || obj.token.length === 0) {
    return null;
  }
  if (typeof obj.password !== "string") {
    return null;
  }
  return { token: obj.token, password: obj.password };
}

async function updatePasswordHash(
  sql: SQL,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
}

export async function handleResetPassword(
  req: Request,
  sql: SQL,
  cache: Cache,
): Promise<Response> {
  const parsed = await readJsonUnknown(req);
  if (!parsed.ok) {
    return jsonApiResponse(
      { error: parsed.error },
      { status: parsed.status },
      new URL(req.url),
    );
  }
  const payload = pickResetPayload(parsed.value);
  if (payload === null) {
    return jsonApiResponse(
      { error: MSG_RESET_PASSWORD_REQUIRED },
      { status: HTTP_STATUS_BAD_REQUEST },
      new URL(req.url),
    );
  }
  if (payload.password.length < MIN_PASSWORD_LENGTH) {
    return jsonApiResponse(
      { error: MSG_PASSWORD_TOO_SHORT },
      { status: HTTP_STATUS_BAD_REQUEST },
      new URL(req.url),
    );
  }
  const consumed = await consumeAuthToken(
    cache,
    sql,
    PASSWORD_RESETS_TABLE,
    payload.token,
  );
  if (!consumed.ok) {
    return jsonApiResponse(
      { error: MSG_AUTH_TOKEN_INVALID },
      { status: HTTP_STATUS_UNAUTHORIZED },
      new URL(req.url),
    );
  }
  const newHash = Bun.password.hashSync(
    payload.password,
    bcryptHashOptions(BCRYPT_COST),
  );
  await updatePasswordHash(sql, consumed.userId, newHash);
  const user = await findUserById(cache, sql, consumed.userId);
  await invalidateUser(cache, {
    id: consumed.userId,
    email: user?.email,
  });
  await revokeAllSessionsForUser(cache, sql, consumed.userId);
  return jsonApiResponse(
    { ok: true },
    { status: HTTP_STATUS_OK },
    new URL(req.url),
  );
}
