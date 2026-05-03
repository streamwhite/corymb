import { MSG_EMAIL_TAKEN, MSG_USERNAME_TAKEN } from "@/constants/messages.js";

/** Maps SQLite UNIQUE on `users` to a client-facing message when possible. */
export function messageForUserUniqueViolation(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("users.username")) {
    return MSG_USERNAME_TAKEN;
  }
  if (msg.includes("users.email")) {
    return MSG_EMAIL_TAKEN;
  }
  return null;
}
