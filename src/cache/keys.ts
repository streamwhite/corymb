import { resolveCacheKeyPrefixFromEnv } from "@/constants/redis.js";

const USER_ID_SEGMENT = "user:id:" as const;
const USER_EMAIL_SEGMENT = "user:email:" as const;
const SESSION_ID_SEGMENT = "session:id:" as const;

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
