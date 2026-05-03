import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
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
  MSG_INVALID_JSON,
  MSG_SIGNUP_UNIQUE_VIOLATION,
} from "@/constants/messages.js";
import {
  AUTH_SIGNIN_PATH,
  AUTH_SIGNOUT_PATH,
  AUTH_SIGNUP_PATH,
} from "@/constants/routes.js";
import type * as schema from "@/db/schema.js";
import { users } from "@/db/schema.js";

const ENV_NODE_ENV = "NODE_ENV" as const;

const COOKIE_PATH = "/" as const;

function isProduction(): boolean {
  return process.env[ENV_NODE_ENV] === "production";
}

function applySessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    path: COOKIE_PATH,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: "Lax",
    secure: isProduction(),
  });
}

function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: COOKIE_PATH,
    secure: isProduction(),
  });
}

async function parseJsonUnknown(c: {
  req: { json: () => Promise<unknown> };
}): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  try {
    const raw = await c.req.json();
    return { ok: true, value: raw };
  } catch {
    return { ok: false, error: MSG_INVALID_JSON };
  }
}

export function createAuthRouter(db: BunSQLiteDatabase<typeof schema>) {
  const r = new Hono();

  r.post(AUTH_SIGNUP_PATH, async (c) => {
    const parsed = await parseJsonUnknown(c);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, 400);
    }
    const creds = validateSignupInput(parsed.value);
    if (!creds.ok) {
      return c.json({ error: creds.error }, 400);
    }
    const userId = randomUUID();
    const passwordHash = bcrypt.hashSync(creds.password, BCRYPT_COST);
    try {
      db.insert(users)
        .values({
          id: userId,
          email: creds.email,
          username: creds.username,
          passwordHash,
        })
        .run();
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        const conflict = messageForUserUniqueViolation(err);
        return c.json({ error: conflict ?? MSG_SIGNUP_UNIQUE_VIOLATION }, 409);
      }
      throw err;
    }
    const token = issueSession(db, userId);
    applySessionCookie(c, token);
    return c.json(
      { user: { id: userId, email: creds.email, username: creds.username } },
      201,
    );
  });

  r.post(AUTH_SIGNIN_PATH, async (c) => {
    const parsed = await parseJsonUnknown(c);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, 400);
    }
    const creds = validateSigninInput(parsed.value);
    if (!creds.ok) {
      return c.json({ error: creds.error }, 400);
    }
    const user = db
      .select()
      .from(users)
      .where(eq(users.email, creds.email))
      .get();
    if (
      user === undefined ||
      !bcrypt.compareSync(creds.password, user.passwordHash)
    ) {
      return c.json({ error: MSG_INVALID_CREDENTIALS }, 401);
    }
    const token = issueSession(db, user.id);
    applySessionCookie(c, token);
    return c.json({
      user: { id: user.id, email: user.email, username: user.username },
    });
  });

  r.post(AUTH_SIGNOUT_PATH, async (c) => {
    const raw = getCookie(c, SESSION_COOKIE_NAME);
    revokeSessionByRawToken(db, raw);
    clearSessionCookie(c);
    return c.json({ ok: true });
  });

  return r;
}
