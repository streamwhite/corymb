import type { Cache } from "@/cache/cache-types.js";
import { SENSITIVE_VERIFY_CACHE_PREFIX } from "@/constants/sensitive-auth.js";

const VERIFIED_VALUE = "1" as const;

/** Records sessions that recently re-authenticated for sensitive operations. */
export type SensitiveVerifyStore = {
  mark(sessionId: string): Promise<void>;
  isVerified(sessionId: string): Promise<boolean>;
  clear(sessionId: string): Promise<void>;
};

function cacheKey(sessionId: string): string {
  return `${SENSITIVE_VERIFY_CACHE_PREFIX}${sessionId}`;
}

export function createSensitiveVerifyStore(
  cache: Cache,
  ttlSeconds: number,
): SensitiveVerifyStore {
  return {
    async mark(sessionId: string): Promise<void> {
      await cache.set(cacheKey(sessionId), VERIFIED_VALUE, ttlSeconds);
    },
    async isVerified(sessionId: string): Promise<boolean> {
      return (await cache.get(cacheKey(sessionId))) !== null;
    },
    async clear(sessionId: string): Promise<void> {
      await cache.del(cacheKey(sessionId));
    },
  };
}
