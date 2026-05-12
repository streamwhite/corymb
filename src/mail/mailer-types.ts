export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type Mailer = {
  send: (message: MailMessage) => Promise<void>;
};
