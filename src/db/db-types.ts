/** Row shape from `users` (API-facing field names). */
export type UserRow = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  emailVerified: number;
  createdAt: string;
};

/** Row from `sessions` for token verification. */
export type SessionRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

/** Shared row shape for `password_resets` / `email_verifications` (single-use tokens). */
export type AuthTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};
