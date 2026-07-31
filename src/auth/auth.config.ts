import { Database } from "bun:sqlite";
import { createBetterAuth } from "@/auth/better-auth.js";
import { createNoopCache } from "@/cache/noop-cache.js";
import { createNoopMailer } from "@/mail/noop-mailer.js";

const database = new Database(":memory:");

/** Exported for Better Auth CLI (`bunx --bun auth generate`). */
export const auth = createBetterAuth({
  database,
  cache: createNoopCache(),
  mailer: createNoopMailer(),
  secret: process.env.BETTER_AUTH_SECRET ?? "cli-secret-at-least-32-characters!!",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});
