import type { SQL } from "bun";
import {
  AUTH_TOKEN_BYTE_LENGTH,
  AUTH_TOKEN_PART_SEPARATOR,
  AUTH_TOKEN_UUID_CHAR_LENGTH,
  type EMAIL_VERIFICATIONS_TABLE,
  PASSWORD_RESETS_TABLE,
} from "@/constants/auth-tokens.js";
import { SESSION_ARGON2_OPTS } from "@/constants/session-token.js";
import type { AuthTokenRow } from "@/db/db-types.js";

export type AuthTokenTable =
  | typeof PASSWORD_RESETS_TABLE
  | typeof EMAIL_VERIFICATIONS_TABLE;

export type ConsumeAuthTokenResult =
  | { ok: true; userId: string; rowId: string }
  | { ok: false };

const SECONDS_PER_MS = 1000 as const;

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hashTokenArgon(rawToken: string): string {
  return Bun.password.hashSync(rawToken, SESSION_ARGON2_OPTS);
}

function isoNowPlusSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * SECONDS_PER_MS).toISOString();
}

function composeToken(rowId: string, rawToken: string): string {
  return `${rowId}${AUTH_TOKEN_PART_SEPARATOR}${rawToken}`;
}

export type ParsedAuthToken = { rowId: string; rawToken: string };

export function parseAuthToken(
  composite: string | undefined,
): ParsedAuthToken | null {
  if (
    composite === undefined ||
    composite.length <= AUTH_TOKEN_UUID_CHAR_LENGTH
  ) {
    return null;
  }
  if (composite.at(AUTH_TOKEN_UUID_CHAR_LENGTH) !== AUTH_TOKEN_PART_SEPARATOR) {
    return null;
  }
  const rowId = composite.slice(0, AUTH_TOKEN_UUID_CHAR_LENGTH);
  const rawToken = composite.slice(
    AUTH_TOKEN_UUID_CHAR_LENGTH + AUTH_TOKEN_PART_SEPARATOR.length,
  );
  if (rawToken.length === 0) {
    return null;
  }
  return { rowId, rawToken };
}

async function insertAuthToken(
  sql: SQL,
  table: AuthTokenTable,
  row: { id: string; userId: string; tokenHash: string; expiresAt: string },
): Promise<void> {
  if (table === PASSWORD_RESETS_TABLE) {
    await sql`
      INSERT INTO password_resets (id, user_id, token_hash, expires_at)
      VALUES (${row.id}, ${row.userId}, ${row.tokenHash}, ${row.expiresAt})
    `;
    return;
  }
  await sql`
    INSERT INTO email_verifications (id, user_id, token_hash, expires_at)
    VALUES (${row.id}, ${row.userId}, ${row.tokenHash}, ${row.expiresAt})
  `;
}

export async function issueAuthToken(
  sql: SQL,
  table: AuthTokenTable,
  userId: string,
  ttlSeconds: number,
): Promise<string> {
  const id = crypto.randomUUID();
  const rawToken = randomHex(AUTH_TOKEN_BYTE_LENGTH);
  const tokenHash = hashTokenArgon(rawToken);
  const expiresAt = isoNowPlusSeconds(ttlSeconds);
  await insertAuthToken(sql, table, {
    id,
    userId,
    tokenHash,
    expiresAt,
  });
  return composeToken(id, rawToken);
}

function firstAuthTokenRow(rows: unknown): AuthTokenRow | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  return rows[0] as AuthTokenRow;
}

async function selectAuthToken(
  sql: SQL,
  table: AuthTokenTable,
  rowId: string,
): Promise<AuthTokenRow | undefined> {
  if (table === PASSWORD_RESETS_TABLE) {
    return firstAuthTokenRow(
      await sql`
      SELECT id, user_id AS userId, token_hash AS tokenHash,
             expires_at AS expiresAt, used_at AS usedAt, created_at AS createdAt
      FROM password_resets
      WHERE id = ${rowId}
    `,
    );
  }
  return firstAuthTokenRow(
    await sql`
    SELECT id, user_id AS userId, token_hash AS tokenHash,
           expires_at AS expiresAt, used_at AS usedAt, created_at AS createdAt
    FROM email_verifications
    WHERE id = ${rowId}
  `,
  );
}

async function markAuthTokenUsed(
  sql: SQL,
  table: AuthTokenTable,
  rowId: string,
): Promise<void> {
  if (table === PASSWORD_RESETS_TABLE) {
    await sql`UPDATE password_resets SET used_at = datetime('now') WHERE id = ${rowId}`;
    return;
  }
  await sql`UPDATE email_verifications SET used_at = datetime('now') WHERE id = ${rowId}`;
}

function isExpired(isoTimestamp: string): boolean {
  const expiresMs = Date.parse(isoTimestamp);
  if (Number.isNaN(expiresMs)) {
    return true;
  }
  return expiresMs <= Date.now();
}

export async function consumeAuthToken(
  sql: SQL,
  table: AuthTokenTable,
  composite: string | undefined,
): Promise<ConsumeAuthTokenResult> {
  const parsed = parseAuthToken(composite);
  if (parsed === null) {
    return { ok: false };
  }
  const row = await selectAuthToken(sql, table, parsed.rowId);
  if (row === undefined) {
    return { ok: false };
  }
  if (row.usedAt !== null) {
    return { ok: false };
  }
  if (isExpired(row.expiresAt)) {
    return { ok: false };
  }
  if (!Bun.password.verifySync(parsed.rawToken, row.tokenHash)) {
    return { ok: false };
  }
  await markAuthTokenUsed(sql, table, row.id);
  return { ok: true, userId: row.userId, rowId: row.id };
}
