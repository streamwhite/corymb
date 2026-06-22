import {
  EMAIL_VERIFICATIONS_TABLE,
  PASSWORD_RESETS_TABLE,
} from "@/constants/auth-tokens.js";
import { resolveCacheKeyPrefixFromEnv } from "@/constants/redis.js";

export type AuthTokenTableName =
  | typeof PASSWORD_RESETS_TABLE
  | typeof EMAIL_VERIFICATIONS_TABLE;

const USER_ID_SEGMENT = "user:id:" as const;
const USER_EMAIL_SEGMENT = "user:email:" as const;
const SESSION_ID_SEGMENT = "session:id:" as const;
const AUTH_TOKEN_SEGMENT = "auth-token:" as const;

function prefix(): string {
  return resolveCacheKeyPrefixFromEnv();
}

export function userByIdKey(userId: string): string {
  return `${prefix()}${USER_ID_SEGMENT}${userId}`;
}

export function userByEmailKey(normalizedEmail: string): string {
  return `${prefix()}${USER_EMAIL_SEGMENT}${normalizedEmail}`;
}

export function sessionByIdKey(sessionId: string): string {
  return `${prefix()}${SESSION_ID_SEGMENT}${sessionId}`;
}

export function authTokenKey(table: AuthTokenTableName, rowId: string): string {
  const tableName =
    table === PASSWORD_RESETS_TABLE
      ? PASSWORD_RESETS_TABLE
      : EMAIL_VERIFICATIONS_TABLE;
  return `${prefix()}${AUTH_TOKEN_SEGMENT}${tableName}:${rowId}`;
}
