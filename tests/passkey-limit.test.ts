import { afterEach, describe, expect, it } from "bun:test";
import { isPasskeyLimitExceeded } from "@/auth/passkey-limit.js";
import {
  DEFAULT_MAX_PASSKEYS_PER_USER,
  resolveMaxPasskeysPerUserFromEnv,
} from "@/constants/better-auth.js";

const ENV_MAX_PASSKEYS_PER_USER = "MAX_PASSKEYS_PER_USER";

describe("passkey limit", () => {
  const original = process.env[ENV_MAX_PASSKEYS_PER_USER];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_MAX_PASSKEYS_PER_USER];
    } else {
      process.env[ENV_MAX_PASSKEYS_PER_USER] = original;
    }
  });

  it("is exceeded when existing count reaches the maximum", () => {
    expect(isPasskeyLimitExceeded(0, 5)).toBe(false);
    expect(isPasskeyLimitExceeded(4, 5)).toBe(false);
    expect(isPasskeyLimitExceeded(5, 5)).toBe(true);
    expect(isPasskeyLimitExceeded(6, 5)).toBe(true);
  });

  it("resolves the limit from env", () => {
    process.env[ENV_MAX_PASSKEYS_PER_USER] = "3";
    expect(resolveMaxPasskeysPerUserFromEnv()).toBe(3);
  });

  it("falls back to the default for missing or invalid env", () => {
    delete process.env[ENV_MAX_PASSKEYS_PER_USER];
    expect(resolveMaxPasskeysPerUserFromEnv()).toBe(
      DEFAULT_MAX_PASSKEYS_PER_USER,
    );
    process.env[ENV_MAX_PASSKEYS_PER_USER] = "0";
    expect(resolveMaxPasskeysPerUserFromEnv()).toBe(
      DEFAULT_MAX_PASSKEYS_PER_USER,
    );
    process.env[ENV_MAX_PASSKEYS_PER_USER] = "abc";
    expect(resolveMaxPasskeysPerUserFromEnv()).toBe(
      DEFAULT_MAX_PASSKEYS_PER_USER,
    );
  });
});
