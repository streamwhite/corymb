import type { SQL } from "bun";
import {
  validateSigninInput,
  validateSignupInput,
} from "@/auth/credentials.js";
import { isUniqueConstraintError } from "@/auth/sqlite-errors.js";
import { messageForUserUniqueViolation } from "@/auth/user-unique.js";
import { BCRYPT_COST } from "@/constants/auth.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import {
  MSG_INVALID_CREDENTIALS,
  MSG_SIGNUP_UNIQUE_VIOLATION,
} from "@/constants/messages.js";
import { bcryptHashOptions } from "@/constants/password-hash.js";
import type { UserRow } from "@/db/db-types.js";
import { readJsonUnknown } from "@/http/json-body.js";
import { jsonApiResponse } from "@/http/json-response.js";
import {
  issueSessionTokens,
  tokensResponseBody,
} from "@/server/auth/shared.js";

function firstUserRow(rows: unknown): UserRow | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  return rows[0] as UserRow;
}

async function readJsonOrError(
  req: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const parsed = await readJsonUnknown(req);
  if (parsed.ok) {
    return { ok: true, value: parsed.value };
  }
  return {
    ok: false,
    response: jsonApiResponse(
      { error: parsed.error },
      { status: parsed.status },
      new URL(req.url),
    ),
  };
}

async function insertNewUser(
  sql: SQL,
  user: { id: string; email: string; username: string; passwordHash: string },
): Promise<{ ok: true } | { ok: false; response: Response }> {
  try {
    await sql`
      INSERT INTO users (id, email, username, password_hash)
      VALUES (${user.id}, ${user.email}, ${user.username}, ${user.passwordHash})
    `;
    return { ok: true };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const conflict = messageForUserUniqueViolation(err);
      return {
        ok: false,
        response: jsonApiResponse(
          { error: conflict ?? MSG_SIGNUP_UNIQUE_VIOLATION },
          { status: HTTP_STATUS_CONFLICT },
        ),
      };
    }
    throw err;
  }
}

export async function handleAuthSignup(
  req: Request,
  sql: SQL,
): Promise<Response> {
  const body = await readJsonOrError(req);
  if (!body.ok) {
    return body.response;
  }
  const creds = validateSignupInput(body.value);
  if (!creds.ok) {
    return jsonApiResponse(
      { error: creds.error },
      { status: HTTP_STATUS_BAD_REQUEST },
      new URL(req.url),
    );
  }
  const userId = crypto.randomUUID();
  const passwordHash = Bun.password.hashSync(
    creds.password,
    bcryptHashOptions(BCRYPT_COST),
  );
  const inserted = await insertNewUser(sql, {
    id: userId,
    email: creds.email,
    username: creds.username,
    passwordHash,
  });
  if (!inserted.ok) {
    return inserted.response;
  }
  const tokens = await issueSessionTokens(sql, userId);
  return jsonApiResponse(
    tokensResponseBody(
      { id: userId, email: creds.email, username: creds.username },
      tokens,
    ),
    { status: HTTP_STATUS_CREATED },
    new URL(req.url),
  );
}

async function findUserByEmail(
  sql: SQL,
  email: string,
): Promise<UserRow | undefined> {
  const rows = await sql`
    SELECT id, email, username, password_hash AS passwordHash,
           email_verified AS emailVerified, created_at AS createdAt
    FROM users
    WHERE email = ${email}
  `;
  return firstUserRow(rows);
}

export async function handleAuthSignin(
  req: Request,
  sql: SQL,
): Promise<Response> {
  const body = await readJsonOrError(req);
  if (!body.ok) {
    return body.response;
  }
  const creds = validateSigninInput(body.value);
  if (!creds.ok) {
    return jsonApiResponse(
      { error: creds.error },
      { status: HTTP_STATUS_BAD_REQUEST },
      new URL(req.url),
    );
  }
  const user = await findUserByEmail(sql, creds.email);
  if (
    user === undefined ||
    !Bun.password.verifySync(creds.password, user.passwordHash)
  ) {
    return jsonApiResponse(
      { error: MSG_INVALID_CREDENTIALS },
      { status: HTTP_STATUS_UNAUTHORIZED },
      new URL(req.url),
    );
  }
  const tokens = await issueSessionTokens(sql, user.id);
  return jsonApiResponse(
    tokensResponseBody(user, tokens),
    { status: HTTP_STATUS_OK },
    new URL(req.url),
  );
}
