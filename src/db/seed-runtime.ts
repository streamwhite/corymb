import { openAuthDatabase } from "@/auth/auth-database.js";
import {
  type BetterAuthInstance,
  createBetterAuth,
} from "@/auth/better-auth.js";
import { createCacheBundle } from "@/cache/client.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { closeDbBundle, createDbBundle, type DbBundle } from "@/db/client.js";
import { createNoopMailer } from "@/mail/noop-mailer.js";
import { resolveMailerFromEnv } from "@/mail/resolve-mailer.js";

export type SeedRuntime = {
  bundle: DbBundle;
  auth: BetterAuthInstance;
  close: () => Promise<void>;
};

export async function createSeedRuntime(options?: {
  databasePath?: string;
  useMemoryCache?: boolean;
}): Promise<SeedRuntime> {
  const bundle = await createDbBundle({
    databasePath: options?.databasePath,
  });
  const cacheBundle = options?.useMemoryCache
    ? { cache: createMemoryCache(), close: () => {} }
    : await createCacheBundle();
  const authDatabase = openAuthDatabase({
    dialect: bundle.dialect,
    sqlitePath: bundle.sqlitePath,
    pgUrl: bundle.pgUrl,
  });
  const auth = createBetterAuth({
    database: authDatabase.database,
    cache: cacheBundle.cache,
    mailer: options?.useMemoryCache
      ? createNoopMailer()
      : resolveMailerFromEnv(),
    secret: options?.useMemoryCache
      ? "test-better-auth-secret-at-least-32-chars!!"
      : undefined,
    baseURL: "http://127.0.0.1",
    trustedOrigins: ["http://127.0.0.1", "http://localhost"],
  });
  return {
    bundle,
    auth,
    close: async () => {
      await authDatabase.close();
      await closeDbBundle(bundle);
      cacheBundle.close();
    },
  };
}
