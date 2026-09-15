import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { username } from "better-auth/plugins/username";
import type { AuthDatabaseDriver } from "@/auth/auth-database.js";
import { createPasskeyLimitHook } from "@/auth/passkey-limit.js";
import { createSecondaryStorage } from "@/auth/secondary-storage.js";
import type { Cache } from "@/cache/cache-types.js";
import { BCRYPT_COST } from "@/constants/auth.js";
import {
  BETTER_AUTH_BASE_PATH,
  PASSKEY_RP_NAME,
  resolveAccessJwtExpirationFromEnv,
  resolveBetterAuthSecretFromEnv,
  resolveBetterAuthUrlFromEnv,
  resolveCookieCacheMaxAgeSecondsFromEnv,
  resolveMaxPasskeysPerUserFromEnv,
  resolvePasskeyRpIdFromEnv,
  resolveSessionExpiresInSecondsFromEnv,
  resolveSessionFreshAgeSecondsFromEnv,
  resolveSessionUpdateAgeSecondsFromEnv,
  resolveTrustedOrigins,
} from "@/constants/better-auth.js";
import {
  MAIL_SUBJECT_PASSWORD_RESET,
  MAIL_SUBJECT_VERIFY_EMAIL,
} from "@/constants/mail.js";
import { bcryptHashOptions } from "@/constants/password-hash.js";
import type { Mailer } from "@/mail/mailer-types.js";
import {
  isNodeEnvDevelopment,
  isNodeEnvProduction,
} from "@/runtime/node-env.js";

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

export type CreateBetterAuthOptions = {
  database: AuthDatabaseDriver;
  cache: Cache;
  mailer: Mailer;
  secret?: string;
  baseURL?: string;
  trustedOrigins?: string[];
  /** Maximum passkeys per user (defaults to env or built-in default). */
  maxPasskeysPerUser?: number;
};

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, bcryptHashOptions(BCRYPT_COST));
}

async function verifyPassword(data: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return Bun.password.verify(data.password, data.hash);
}

export function createBetterAuth(options: CreateBetterAuthOptions) {
  const secret = options.secret ?? resolveBetterAuthSecretFromEnv();
  const baseURL = options.baseURL ?? resolveBetterAuthUrlFromEnv();
  const secondaryStorage = createSecondaryStorage(options.cache);
  const { mailer } = options;

  return betterAuth({
    database: options.database,
    baseURL,
    basePath: BETTER_AUTH_BASE_PATH,
    secret,
    secondaryStorage,
    trustedOrigins:
      options.trustedOrigins ??
      resolveTrustedOrigins(baseURL, isNodeEnvDevelopment()),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
      sendResetPassword: async ({ user, url }) => {
        await mailer.send({
          to: user.email,
          subject: MAIL_SUBJECT_PASSWORD_RESET,
          text: `Reset your password: ${url}`,
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send({
          to: user.email,
          subject: MAIL_SUBJECT_VERIFY_EMAIL,
          text: `Verify your email: ${url}`,
        });
      },
    },
    session: {
      expiresIn: resolveSessionExpiresInSecondsFromEnv(),
      updateAge: resolveSessionUpdateAgeSecondsFromEnv(),
      freshAge: resolveSessionFreshAgeSecondsFromEnv(),
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: true,
        maxAge: resolveCookieCacheMaxAgeSecondsFromEnv(),
      },
    },
    hooks: {
      before: createPasskeyLimitHook(
        options.maxPasskeysPerUser ?? resolveMaxPasskeysPerUserFromEnv(),
      ),
    },
    verification: {
      storeInDatabase: true,
    },
    advanced: {
      useSecureCookies: isNodeEnvProduction(),
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
    plugins: [
      username(),
      jwt({
        jwt: {
          expirationTime: resolveAccessJwtExpirationFromEnv(),
        },
      }),
      bearer(),
      passkey({
        rpID: resolvePasskeyRpIdFromEnv(baseURL),
        rpName: PASSKEY_RP_NAME,
        authenticatorSelection: {
          userVerification: "required",
          residentKey: "required",
        },
      }),
    ],
  });
}
