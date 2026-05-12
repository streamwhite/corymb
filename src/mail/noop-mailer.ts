import type { Mailer } from "@/mail/mailer-types.js";

export function createNoopMailer(): Mailer {
  return {
    send: async () => {
      // intentionally drops all messages
    },
  };
}
