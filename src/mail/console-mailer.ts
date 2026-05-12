import type { Mailer, MailMessage } from "@/mail/mailer-types.js";

const LOG_PREFIX = "[mail]" as const;

function logMessage(message: MailMessage): void {
  console.info(`${LOG_PREFIX} to=${message.to} subject="${message.subject}"`);
  console.info(message.text);
}

export function createConsoleMailer(): Mailer {
  return {
    send: async (message) => {
      logMessage(message);
    },
  };
}
