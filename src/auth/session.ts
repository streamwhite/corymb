import type { SQL } from "bun";
import {
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
  cookieValue: string | undefined,
): ParsedSessionCookie | null {
  if (
    cookieValue === undefined ||
    cookieValue.length <= SESSION_UUID_CHAR_LENGTH
  ) {
    return null;
  }
  const sep = SESSION_COOKIE_PART_SEPARATOR;
  if (cookieValue.at(SESSION_UUID_CHAR_LENGTH) !== sep) {
    return null;
  }
  const sessionId = cookieValue.slice(0, SESSION_UUID_CHAR_LENGTH);
  const rawToken = cookieValue.slice(SESSION_UUID_CHAR_LENGTH + sep.length);
  if (rawToken.length === 0) {
    return null;
  }
  return { sessionId, rawToken };
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

export async function revokeSessionByRawToken(
  sql: SQL,
  rawCookie: string | undefined,
): Promise<void> {
  const parsed = parseSessionCookieValue(rawCookie);
  if (parsed === null) {
    return;
  }
  const rows = await sql`
    SELECT id, user_id AS userId, token_hash AS tokenHash,
           expires_at AS expiresAt, created_at AS createdAt
    FROM sessions
    WHERE id = ${parsed.sessionId}
  `;
  const row = firstSessionRow(rows);
  if (row === undefined) {
    return;
  }
  if (!Bun.password.verifySync(parsed.rawToken, row.tokenHash)) {
    return;
  }
  await sql`DELETE FROM sessions WHERE id = ${parsed.sessionId}`;
}
