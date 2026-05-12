import {
  ENV_MAILER_DRIVER,
  MAILER_DRIVER_CONSOLE,
  MAILER_DRIVER_NOOP,
} from "@/constants/mail.js";
import { createConsoleMailer } from "@/mail/console-mailer.js";
import type { Mailer } from "@/mail/mailer-types.js";
import { createNoopMailer } from "@/mail/noop-mailer.js";

export function resolveMailerFromEnv(): Mailer {
  const driver = process.env[ENV_MAILER_DRIVER];
  if (driver === MAILER_DRIVER_NOOP) {
    return createNoopMailer();
  }
  if (driver === undefined || driver === MAILER_DRIVER_CONSOLE) {
    return createConsoleMailer();
  }
  return createConsoleMailer();
}
