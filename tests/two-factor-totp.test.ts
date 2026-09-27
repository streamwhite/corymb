import { describe, expect, it } from "bun:test";
import { createOTP } from "@better-auth/utils/otp";
import { BETTER_AUTH_BASE_PATH } from "@/constants/better-auth.js";
import { createMemoryAppWithMailer } from "./helpers/app-memory-mail.js";
import { signupUser } from "./helpers/auth-flow.js";
import { PG_AVAILABLE } from "./helpers/test-db.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" as const;

/** Decodes the base32 secret from an otpauth URI, as an authenticator would. */
function decodeBase32(input: string): string {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of input.toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

async function totpCodeFromUri(uri: string): Promise<string> {
  const secret = /[?&]secret=([A-Z2-7]+)/.exec(uri)?.[1] ?? "";
  return createOTP(decodeBase32(secret), { period: 30, digits: 6 }).totp();
}

const ENABLE_2FA_PATH = `${BETTER_AUTH_BASE_PATH}/two-factor/enable` as const;
const VERIFY_TOTP_PATH = `${BETTER_AUTH_BASE_PATH}/two-factor/verify-totp` as const;
const VERIFY_BACKUP_CODE_PATH =
  `${BETTER_AUTH_BASE_PATH}/two-factor/verify-backup-code` as const;

const PASSWORD = "x".repeat(16);
const EMAIL = "totp@example.com";
const SECRET_PATTERN = /[?&]secret=([A-Z2-7]+)/;

function extractSecret(uri: string): string | undefined {
  return SECRET_PATTERN.exec(uri)?.[1];
}

describe.skipIf(!PG_AVAILABLE)("two-factor TOTP", () => {
  const jsonHeaders = { "Content-Type": "application/json" } as const;

  async function setupTotp() {
    const { app } = await createMemoryAppWithMailer();
    const signed = await signupUser(app.request, {
      email: EMAIL,
      username: "totp_user",
      password: PASSWORD,
    });
    expect(signed.status).toBe(200);
    const jar = { value: signed.cookies };

    const enable = await app.requestWithCookies(
      ENABLE_2FA_PATH,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ password: PASSWORD, method: "totp" }),
      },
      jar,
    );
    expect(enable.status).toBe(200);
    const body = (await enable.json()) as {
      method?: string;
      totpURI?: string;
      backupCodes?: string[];
    };
    expect(body.method).toBe("totp");
    expect(body.totpURI).toBeTruthy();
    expect(body.backupCodes?.length).toBeGreaterThan(0);
    const secret = extractSecret(body.totpURI ?? "");
    expect(secret).toBeDefined();
    return {
      app,
      jar,
      secret: secret ?? "",
      totpURI: body.totpURI ?? "",
      backupCodes: body.backupCodes ?? [],
    };
  }

  it("enables TOTP and returns an otpauth URI with backup codes", async () => {
    const { secret } = await setupTotp();
    expect(secret.length).toBeGreaterThan(0);
  });

  it("verifies a TOTP code derived from the otpauth secret", async () => {
    const { app, jar, totpURI } = await setupTotp();
    const code = await totpCodeFromUri(totpURI);
    expect(code).toHaveLength(6);

    const verify = await app.requestWithCookies(
      VERIFY_TOTP_PATH,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ code }),
      },
      jar,
    );
    expect(verify.status).toBe(200);
    const body = (await verify.json()) as { token?: string };
    expect(body.token).toBeTruthy();
  });

  it("rejects an invalid TOTP code", async () => {
    const { app, jar } = await setupTotp();
    const verify = await app.requestWithCookies(
      VERIFY_TOTP_PATH,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ code: "000000" }),
      },
      jar,
    );
    expect(verify.status).toBeGreaterThanOrEqual(400);
  });

  it("accepts a valid backup code", async () => {
    const { app, jar, backupCodes } = await setupTotp();
    const verify = await app.requestWithCookies(
      VERIFY_BACKUP_CODE_PATH,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ code: backupCodes[0] }),
      },
      jar,
    );
    expect(verify.status).toBe(200);
  });

  it("exposes the totp paths under the auth base path", () => {
    expect(VERIFY_TOTP_PATH).toBe("/api/auth/two-factor/verify-totp");
    expect(VERIFY_BACKUP_CODE_PATH).toBe(
      "/api/auth/two-factor/verify-backup-code",
    );
  });
});
