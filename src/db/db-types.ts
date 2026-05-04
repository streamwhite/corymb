/** Row shape from `users` (API-facing field names). */
export type UserRow = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
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
