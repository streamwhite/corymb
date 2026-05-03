import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_TOKEN_BYTE_LENGTH,
} from "@/constants/auth.js";
import type * as schema from "@/db/schema.js";
import { sessions } from "@/db/schema.js";

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function generateRawSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTE_LENGTH).toString("hex");
}

export function issueSession(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
): string {
  const sessionId = randomUUID();
  const rawToken = generateRawSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();
  db.insert(sessions)
    .values({
      id: sessionId,
      userId,
      tokenHash,
      expiresAt,
    })
    .run();
  return rawToken;
}

export function revokeSessionByRawToken(
  db: BetterSQLite3Database<typeof schema>,
  rawToken: string | undefined,
): void {
  if (rawToken === undefined || rawToken.length === 0) {
    return;
  }
  db.delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(rawToken)))
    .run();
}
