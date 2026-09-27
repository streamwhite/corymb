import { openAuthDatabase } from "@/auth/auth-database.js";
import {
  type BetterAuthInstance,
  createBetterAuth,
} from "@/auth/better-auth.js";
import type { Cache } from "@/cache/cache-types.js";
import {
  type DatabaseConfig,
  resolveDatabaseConfigFromEnv,
} from "@/constants/database.js";
import type { Mailer } from "@/mail/mailer-types.js";

export type CreateAuthRuntimeOptions = {
  cache: Cache;
  mailer: Mailer;
  databaseConfig?: DatabaseConfig;
  secret?: string;
  baseURL?: string;
  trustedOrigins?: string[];
  maxPasskeysPerUser?: number;
};

export type AuthRuntime = {
  auth: BetterAuthInstance;
  close: () => Promise<void>;
};

/** Builds the Better Auth instance and owns its Postgres pool lifetime. */
export function createAuthRuntime(
  options: CreateAuthRuntimeOptions,
): AuthRuntime {
  const config = options.databaseConfig ?? resolveDatabaseConfigFromEnv();
  const bundle = openAuthDatabase(config);
  const auth = createBetterAuth({
    database: bundle.database,
    cache: options.cache,
    mailer: options.mailer,
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    maxPasskeysPerUser: options.maxPasskeysPerUser,
  });
  return { auth, close: bundle.close };
}
