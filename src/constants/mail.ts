export const ENV_MAIL_FROM = "MAIL_FROM" as const;

export const ENV_APP_PUBLIC_BASE_URL = "APP_PUBLIC_BASE_URL" as const;

export const ENV_MAILER_DRIVER = "MAILER_DRIVER" as const;

export const MAILER_DRIVER_CONSOLE = "console" as const;

export const MAILER_DRIVER_NOOP = "noop" as const;

export const DEFAULT_MAIL_FROM = "no-reply@hono-hands-on.local" as const;

export const DEFAULT_APP_PUBLIC_BASE_URL = "http://localhost:3000" as const;

export const MAIL_SUBJECT_PASSWORD_RESET = "Reset your password" as const;

export const MAIL_SUBJECT_VERIFY_EMAIL = "Verify your email" as const;

/** Querystring key carrying single-use tokens in user-clickable links. */
export const MAIL_LINK_TOKEN_PARAM = "token" as const;
