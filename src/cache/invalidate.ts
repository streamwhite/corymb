import { invalidateKeys } from "@/cache/cache-aside.js";
import type { Cache } from "@/cache/cache-types.js";
import {
  authTokenKey,
  sessionByIdKey,
  userByEmailKey,
  userByIdKey,
} from "@/cache/keys.js";
import type { AuthTokenTableName } from "@/cache/keys.js";

export type InvalidateUserInput = {
  id: string;
  email?: string;
};

export async function invalidateUser(
  cache: Cache,
  input: InvalidateUserInput,
): Promise<void> {
  const keys = [userByIdKey(input.id)];
  if (input.email !== undefined && input.email.length > 0) {
    keys.push(userByEmailKey(input.email));
  }
  await invalidateKeys(cache, keys);
}

export async function invalidateSession(
  cache: Cache,
  sessionId: string,
): Promise<void> {
  await cache.del(sessionByIdKey(sessionId));
}

export async function invalidateAuthToken(
  cache: Cache,
  table: AuthTokenTableName,
  rowId: string,
): Promise<void> {
  await cache.del(authTokenKey(table, rowId));
}
