import { afterEach, describe, expect, it } from "bun:test";
import {
  DEFAULT_APP_PUBLIC_BASE_URL,
  ENV_APP_PUBLIC_BASE_URL,
  ENV_MAILER_DRIVER,
  MAIL_LINK_TOKEN_PARAM,
} from "@/constants/mail.js";
import { createInMemoryMailer } from "@/mail/in-memory-mailer.js";
import {
  emailVerifyBody,
  passwordResetBody,
  twoFactorBody,
} from "@/mail/mail-bodies.js";
import {
  buildEmailVerifyLink,
  buildPasswordResetLink,
} from "@/mail/mail-links.js";
import type { MailMessage } from "@/mail/mailer-types.js";
import { resolveMailerFromEnv } from "@/mail/resolve-mailer.js";

const originalBaseUrl = process.env[ENV_APP_PUBLIC_BASE_URL];
const originalDriver = process.env[ENV_MAILER_DRIVER];

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env[ENV_APP_PUBLIC_BASE_URL];
  else process.env[ENV_APP_PUBLIC_BASE_URL] = originalBaseUrl;
  if (originalDriver === undefined) delete process.env[ENV_MAILER_DRIVER];
  else process.env[ENV_MAILER_DRIVER] = originalDriver;
});

const MESSAGE: MailMessage = {
  to: "user@example.com",
  subject: "Hello",
  text: "Body",
};

function captureConsoleInfo(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.info;
  console.info = (line: unknown) => lines.push(String(line));
  try {
    fn();
  } finally {
    console.info = original;
  }
  return lines;
}

describe("mail links", () => {
  it("builds password-reset and verify links with the token param", () => {
    delete process.env[ENV_APP_PUBLIC_BASE_URL];
    const reset = new URL(buildPasswordResetLink("abc"));
    expect(reset.origin).toBe(new URL(DEFAULT_APP_PUBLIC_BASE_URL).origin);
    expect(reset.searchParams.get(MAIL_LINK_TOKEN_PARAM)).toBe("abc");
    expect(reset.pathname).toContain("reset-password");

    const verify = new URL(buildEmailVerifyLink("xyz"));
    expect(verify.searchParams.get(MAIL_LINK_TOKEN_PARAM)).toBe("xyz");
  });

  it("uses APP_PUBLIC_BASE_URL and trims trailing slashes", () => {
    process.env[ENV_APP_PUBLIC_BASE_URL] = "https://app.example.com///";
    const link = new URL(buildPasswordResetLink("t"));
    expect(link.origin).toBe("https://app.example.com");
  });
});

describe("mail bodies", () => {
  it("renders the password reset body with a minute TTL", () => {
    const body = passwordResetBody("https://x.test/reset");
    expect(body).toContain("30 minutes");
    expect(body).toContain("https://x.test/reset");
  });

  it("renders the verify body with an hour TTL of at least one", () => {
    expect(emailVerifyBody("https://x.test/v", 3600)).toContain("1 hours");
    expect(emailVerifyBody("https://x.test/v", 30)).toContain("1 hours");
    expect(emailVerifyBody("https://x.test/v", 7200)).toContain("2 hours");
  });

  it("renders the OTP body with the code and period", () => {
    const body = twoFactorBody("123456", 5);
    expect(body).toContain("123456");
    expect(body).toContain("5 minute(s)");
  });
});

describe("mailer resolution", () => {
  it("uses the console mailer by default and for unknown drivers", () => {
    delete process.env[ENV_MAILER_DRIVER];
    const lines = captureConsoleInfo(() => {
      void resolveMailerFromEnv().send(MESSAGE);
    });
    // send is async but console.info runs synchronously before the await resolves.
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("[mail] to=user@example.com");

    process.env[ENV_MAILER_DRIVER] = "carrier-pigeon";
    const unknown = captureConsoleInfo(() => {
      void resolveMailerFromEnv().send(MESSAGE);
    });
    expect(unknown.length).toBeGreaterThan(0);
  });

  it("uses the noop mailer for MAILER_DRIVER=noop", () => {
    process.env[ENV_MAILER_DRIVER] = "noop";
    const lines = captureConsoleInfo(() => {
      void resolveMailerFromEnv().send(MESSAGE);
    });
    expect(lines).toEqual([]);
  });
});

describe("in-memory mailer", () => {
  it("records messages and finds the latest per recipient", async () => {
    const mailer = createInMemoryMailer();
    await mailer.send({ to: "a@x.test", subject: "1", text: "one" });
    await mailer.send({ to: "b@x.test", subject: "2", text: "two" });
    await mailer.send({ to: "a@x.test", subject: "3", text: "three" });
    expect(mailer.outbox).toHaveLength(3);
    expect(mailer.lastFor("a@x.test")?.subject).toBe("3");
    expect(mailer.lastFor("missing@x.test")).toBeUndefined();
    mailer.reset();
    expect(mailer.outbox).toHaveLength(0);
  });
});
