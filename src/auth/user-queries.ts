import type { SQL } from "bun";
import { getOrLoad } from "@/cache/cache-aside.js";
import type { Cache } from "@/cache/cache-types.js";
import { userByEmailKey, userByIdKey } from "@/cache/keys.js";
import { resolveCacheUserTtlSecondsFromEnv } from "@/constants/redis.js";
import type { UserRow } from "@/db/db-types.js";

function firstUserRow(rows: unknown): UserRow | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  return rows[0] as UserRow;
}

async function loadUserByEmailFromDb(
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

async function loadUserByIdFromDb(
  sql: SQL,
  userId: string,
): Promise<UserRow | undefined> {
  const rows = await sql`
    SELECT id, email, username, password_hash AS passwordHash,
           email_verified AS emailVerified, created_at AS createdAt
    FROM users
    WHERE id = ${userId}
  `;
  return firstUserRow(rows);
}

export async function findUserByEmail(
  cache: Cache,
  sql: SQL,
  email: string,
): Promise<UserRow | undefined> {
  const ttlSeconds = resolveCacheUserTtlSecondsFromEnv();
  return getOrLoad({
    cache,
    key: userByEmailKey(email),
    ttlSeconds,
    loader: () => loadUserByEmailFromDb(sql, email),
  });
}

export async function findUserById(
  cache: Cache,
  sql: SQL,
  userId: string,
): Promise<UserRow | undefined> {
  const ttlSeconds = resolveCacheUserTtlSecondsFromEnv();
  return getOrLoad({
    cache,
    key: userByIdKey(userId),
    ttlSeconds,
    loader: () => loadUserByIdFromDb(sql, userId),
  });
}

export async function findUserIdByEmail(
  cache: Cache,
  sql: SQL,
  email: string,
): Promise<string | undefined> {
  const user = await findUserByEmail(cache, sql, email);
  return user?.id;
}
