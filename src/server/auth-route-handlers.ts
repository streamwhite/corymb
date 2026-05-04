import type { SQL } from "bun";
import {
  validateSigninInput,
  validateSignupInput,
} from "@/auth/credentials.js";
import { issueSession, revokeSessionByRawToken } from "@/auth/session.js";
import { isUniqueConstraintError } from "@/auth/sqlite-errors.js";
import { messageForUserUniqueViolation } from "@/auth/user-unique.js";
import {
  BCRYPT_COST,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/constants/auth.js";
import {
  MSG_INVALID_CREDENTIALS,
  MSG_SIGNUP_UNIQUE_VIOLATION,
} from "@/constants/messages.js";
import { bcryptHashOptions } from "@/constants/password-hash.js";
import type { UserRow } from "@/db/db-types.js";
import {
  formatClearCookie,
  formatSetCookie,
  readCookieValue,
} from "@/http/cookies.js";
import { readJsonUnknown } from "@/http/json-body.js";

const ENV_NODE_ENV = "NODE_ENV" as const;
const COOKIE_PATH = "/" as const;
const HEADER_SET_COOKIE = "Set-Cookie" as const;

function isProduction(): boolean {
  return process.env[ENV_NODE_ENV] === "production";
}

function firstUserRow(rows: unknown): UserRow | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  return rows[0] as UserRow;
}

function sessionCookieAttrs(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    path: COOKIE_PATH,
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: isProduction(),
  };
}

export async function handleAuthSignup(
  req: Request,
  sql: SQL,
): Promise<Response> {
  const parsed = await readJsonUnknown(req);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const creds = validateSignupInput(parsed.value);
  if (!creds.ok) {
    return Response.json({ error: creds.error }, { status: 400 });
  }
  const userId = crypto.randomUUID();
  const passwordHash = Bun.password.hashSync(
    creds.password,
    bcryptHashOptions(BCRYPT_COST),
  );
  try {
    await sql`
      INSERT INTO users (id, email, username, password_hash)
      VALUES (${userId}, ${creds.email}, ${creds.username}, ${passwordHash})
    `;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const conflict = messageForUserUniqueViolation(err);
      return Response.json(
        { error: conflict ?? MSG_SIGNUP_UNIQUE_VIOLATION },
        { status: 409 },
      );
    }
    throw err;
  }
  const token = await issueSession(sql, userId);
  return new Response(
    JSON.stringify({
      user: { id: userId, email: creds.email, username: creds.username },
    }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        [HEADER_SET_COOKIE]: formatSetCookie(sessionCookieAttrs(token)),
      },
    },
  );
}

export async function handleAuthSignin(
  req: Request,
  sql: SQL,
): Promise<Response> {
  const parsed = await readJsonUnknown(req);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const creds = validateSigninInput(parsed.value);
  if (!creds.ok) {
    return Response.json({ error: creds.error }, { status: 400 });
  }
  const rows = await sql`
    SELECT id, email, username, password_hash AS passwordHash,
           created_at AS createdAt
    FROM users
    WHERE email = ${creds.email}
  `;
  const user = firstUserRow(rows);
  if (
    user === undefined ||
    !Bun.password.verifySync(creds.password, user.passwordHash)
  ) {
    return Response.json({ error: MSG_INVALID_CREDENTIALS }, { status: 401 });
  }
  const token = await issueSession(sql, user.id);
  return new Response(
    JSON.stringify({
      user: { id: user.id, email: user.email, username: user.username },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        [HEADER_SET_COOKIE]: formatSetCookie(sessionCookieAttrs(token)),
      },
    },
  );
}

export async function handleAuthSignout(
  req: Request,
  sql: SQL,
): Promise<Response> {
  const raw = readCookieValue(req.headers.get("cookie"), SESSION_COOKIE_NAME);
  await revokeSessionByRawToken(sql, raw);
  const clear = formatClearCookie({
    name: SESSION_COOKIE_NAME,
    path: COOKIE_PATH,
    secure: isProduction(),
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      [HEADER_SET_COOKIE]: clear,
    },
  });
}
