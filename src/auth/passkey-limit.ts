import { APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { AUTH_PASSKEY_VERIFY_REGISTRATION_PATH } from "@/constants/better-auth.js";
import { MSG_PASSKEY_LIMIT_EXCEEDED } from "@/constants/messages.js";

export function isPasskeyLimitExceeded(count: number, max: number): boolean {
  return count >= max;
}

/** Blocks passkey registration when the user already has `max` passkeys. */
export function createPasskeyLimitHook(max: number) {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== AUTH_PASSKEY_VERIFY_REGISTRATION_PATH) {
      return;
    }
    const userId = ctx.context.session?.user?.id;
    if (userId === undefined) {
      return;
    }
    const passkeys = await ctx.context.adapter.findMany({
      model: "passkey",
      where: [{ field: "userId", value: userId }],
    });
    if (isPasskeyLimitExceeded(passkeys.length, max)) {
      throw new APIError("BAD_REQUEST", {
        message: MSG_PASSKEY_LIMIT_EXCEEDED,
      });
    }
  });
}
