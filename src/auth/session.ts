import type { SQL } from "bun";
import {
  AUTH_BEARER_HEADER_PREFIX,
  SESSION_MAX_AGE_SECONDS,
  SESSION_TOKEN_BYTE_LENGTH,
} from "@/constants/auth.js";
import {
  SESSION_ARGON2_OPTS,
  SESSION_COOKIE_PART_SEPARATOR,
  SESSION_UUID_CHAR_LENGTH,
} from "@/constants/session-token.js";
import type { SessionRow } from "@/db/db-types.js";

function randomBytesHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateRawSessionToken(): string {
  return randomBytesHex(SESSION_TOKEN_BYTE_LENGTH);
}

function hashSessionTokenArgon(rawToken: string): string {
  return Bun.password.hashSync(rawToken, SESSION_ARGON2_OPTS);
}

export type ParsedSessionCookie = {
  sessionId: string;
  rawToken: string;
};

export function parseSessionCookieValue(
  compositeToken: string | undefined,
): ParsedSessionCookie | null {
  if (
    compositeToken === undefined ||
    compositeToken.length <= SESSION_UUID_CHAR_LENGTH
  ) {
    return null;
  }
  const sep = SESSION_COOKIE_PART_SEPARATOR;
  if (compositeToken.at(SESSION_UUID_CHAR_LENGTH) !== sep) {
    return null;
  }
  const sessionId = compositeToken.slice(0, SESSION_UUID_CHAR_LENGTH);
  const rawToken = compositeToken.slice(SESSION_UUID_CHAR_LENGTH + sep.length);
  if (rawToken.length === 0) {
    return null;
  }
  return { sessionId, rawToken };
}

export function parseBearerSessionToken(
  authorizationHeader: string | null,
): string | null {
  if (authorizationHeader === null || authorizationHeader.length === 0) {
    return null;
  }
  const prefix = AUTH_BEARER_HEADER_PREFIX;
  if (!authorizationHeader.startsWith(prefix)) {
    return null;
  }
  const rest = authorizationHeader.slice(prefix.length).trim();
  return rest.length === 0 ? null : rest;
}

function firstSessionRow(rows: unknown): SessionRow | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  return rows[0] as SessionRow;
}

export async function issueSession(sql: SQL, userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const rawToken = generateRawSessionToken();
  const tokenHash = hashSessionTokenArgon(rawToken);
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();
  await sql`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (${sessionId}, ${userId}, ${tokenHash}, ${expiresAt})
  `;
  return `${sessionId}${SESSION_COOKIE_PART_SEPARATOR}${rawToken}`;
}

async function loadValidatedSession(
  sql: SQL,
  compositeSessionToken: string | undefined,
): Promise<SessionRow | undefined> {
  const parsed = parseSessionCookieValue(compositeSessionToken);
  if (parsed === null) {
    return undefined;
  }
  const rows = await sql`
    SELECT id, user_id AS userId, token_hash AS tokenHash,
           expires_at AS expiresAt, created_at AS createdAt
    FROM sessions
    WHERE id = ${parsed.sessionId}
  `;
  const row = firstSessionRow(rows);
  if (row === undefined) {
    return undefined;
  }
  if (!Bun.password.verifySync(parsed.rawToken, row.tokenHash)) {
    return undefined;
  }
  return row;
}

export async function revokeSessionByRawToken(
  sql: SQL,
  compositeSessionToken: string | undefined,
): Promise<void> {
  const row = await loadValidatedSession(sql, compositeSessionToken);
  if (row === undefined) {
    return;
  }
  await sql`DELETE FROM sessions WHERE id = ${row.id}`;
}

export type ConsumeRefreshTokenResult =
  | { ok: true; userId: string }
  | { ok: false };

/** Verifies + deletes the refresh-token session (one-shot consume for rotation). */
export async function consumeRefreshToken(
  sql: SQL,
  compositeSessionToken: string | undefined,
): Promise<ConsumeRefreshTokenResult> {
  const row = await loadValidatedSession(sql, compositeSessionToken);
  if (row === undefined) {
    return { ok: false };
  }
  await sql`DELETE FROM sessions WHERE id = ${row.id}`;
  return { ok: true, userId: row.userId };
}

export async function revokeAllSessionsForUser(
  sql: SQL,
  userId: string,
): Promise<void> {
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}
