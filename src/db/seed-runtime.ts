import { createAuthRuntime } from "@/auth/auth-runtime.js";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import { createCacheBundle } from "@/cache/client.js";
import { createMemoryCache } from "@/cache/memory-cache.js";
import type { DatabaseConfig } from "@/constants/database.js";
import { createNoopMailer } from "@/mail/noop-mailer.js";
import { resolveMailerFromEnv } from "@/mail/resolve-mailer.js";

const TEST_AUTH_SECRET = "test-better-auth-secret-at-least-32-chars!!" as const;
const TEST_BASE_URL = "http://127.0.0.1" as const;
const TEST_TRUSTED_ORIGINS = ["http://127.0.0.1", "http://localhost"] as const;

export type SeedRuntime = {
  auth: BetterAuthInstance;
  close: () => Promise<void>;
};

export async function createSeedRuntime(options?: {
  useMemoryCache?: boolean;
  databaseConfig?: DatabaseConfig;
}): Promise<SeedRuntime> {
  const useMemory = options?.useMemoryCache === true;
  const cacheBundle = useMemory
    ? { cache: createMemoryCache(), close: () => {} }
    : await createCacheBundle();
  const authRuntime = createAuthRuntime({
    cache: cacheBundle.cache,
    mailer: useMemory ? createNoopMailer() : resolveMailerFromEnv(),
    databaseConfig: options?.databaseConfig,
    secret: useMemory ? TEST_AUTH_SECRET : undefined,
    baseURL: TEST_BASE_URL,
    trustedOrigins: [...TEST_TRUSTED_ORIGINS],
  });
  return {
    auth: authRuntime.auth,
    close: async () => {
      await authRuntime.close();
      cacheBundle.close();
    },
  };
}
