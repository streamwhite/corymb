import type { Mailer, MailMessage } from "@/mail/mailer-types.js";

export type InMemoryMailer = Mailer & {
  outbox: MailMessage[];
  reset: () => void;
  lastFor: (to: string) => MailMessage | undefined;
};

export function createInMemoryMailer(): InMemoryMailer {
  const outbox: MailMessage[] = [];
  return {
    outbox,
    send: async (message) => {
      outbox.push(message);
    },
    reset: () => {
      outbox.length = 0;
    },
    lastFor: (to) => {
      for (let i = outbox.length - 1; i >= 0; i -= 1) {
        const m = outbox[i];
        if (m && m.to === to) {
          return m;
        }
      }
      return undefined;
    },
  };
}
