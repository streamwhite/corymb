import type { SQL } from "bun";
import type { Cache } from "@/cache/cache-types.js";
import { invalidateSession } from "@/cache/invalidate.js";
import { sessionByIdKey } from "@/cache/keys.js";
import {
  AUTH_BEARER_HEADER_PREFIX,
  SESSION_MAX_AGE_SECONDS,
  SESSION_TOKEN_BYTE_LENGTH,
} from "@/constants/auth.js";
import {
  resolveCacheSessionTtlSecondsFromEnv,
  ttlSecondsUntilExpiry,
} from "@/constants/redis.js";
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

async function loadSessionRowFromDb(
  sql: SQL,
  sessionId: string,
): Promise<SessionRow | undefined> {
  const rows = await sql`
    SELECT id, user_id AS userId, token_hash AS tokenHash,
           expires_at AS expiresAt, created_at AS createdAt
    FROM sessions
    WHERE id = ${sessionId}
  `;
  return firstSessionRow(rows);
}

function isSessionExpired(row: SessionRow): boolean {
  const expiresMs = Date.parse(row.expiresAt);
  if (Number.isNaN(expiresMs)) {
    return true;
  }
  return expiresMs <= Date.now();
}

async function loadSessionRow(
  cache: Cache,
  sql: SQL,
  sessionId: string,
): Promise<SessionRow | undefined> {
  const capSeconds = resolveCacheSessionTtlSecondsFromEnv();
  const key = sessionByIdKey(sessionId);
  const cached = await cache.get(key);
  if (cached !== null) {
    try {
      const row = JSON.parse(cached) as SessionRow;
      if (!isSessionExpired(row)) {
        return row;
      }
    } catch {
      // ignore corrupt cache entry
    }
  }
  const row = await loadSessionRowFromDb(sql, sessionId);
  if (row === undefined || isSessionExpired(row)) {
    return undefined;
  }
  const ttlSeconds = ttlSecondsUntilExpiry(row.expiresAt, capSeconds);
  await cache.set(key, JSON.stringify(row), ttlSeconds);
  return row;
}

async function loadValidatedSession(
  cache: Cache,
  sql: SQL,
  compositeSessionToken: string | undefined,
): Promise<SessionRow | undefined> {
  const parsed = parseSessionCookieValue(compositeSessionToken);
  if (parsed === null) {
    return undefined;
  }
  const row = await loadSessionRow(cache, sql, parsed.sessionId);
  if (row === undefined) {
    return undefined;
  }
  if (!Bun.password.verifySync(parsed.rawToken, row.tokenHash)) {
    return undefined;
  }
  return row;
}

export async function revokeSessionByRawToken(
  cache: Cache,
  sql: SQL,
  compositeSessionToken: string | undefined,
): Promise<void> {
  const row = await loadValidatedSession(cache, sql, compositeSessionToken);
  if (row === undefined) {
    return;
  }
  await sql`DELETE FROM sessions WHERE id = ${row.id}`;
  await invalidateSession(cache, row.id);
}

export type ConsumeRefreshTokenResult =
  | { ok: true; userId: string }
  | { ok: false };

/** Verifies + deletes the refresh-token session (one-shot consume for rotation). */
export async function consumeRefreshToken(
  cache: Cache,
  sql: SQL,
  compositeSessionToken: string | undefined,
): Promise<ConsumeRefreshTokenResult> {
  const row = await loadValidatedSession(cache, sql, compositeSessionToken);
  if (row === undefined) {
    return { ok: false };
  }
  await sql`DELETE FROM sessions WHERE id = ${row.id}`;
  await invalidateSession(cache, row.id);
  return { ok: true, userId: row.userId };
}

export async function revokeAllSessionsForUser(
  _cache: Cache,
  sql: SQL,
  userId: string,
): Promise<void> {
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}
