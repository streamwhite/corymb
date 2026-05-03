import { describe, expect, it } from "bun:test";
import { validateSignupInput } from "@/auth/credentials.js";
import { MIN_PASSWORD_LENGTH } from "@/constants/auth.js";
import { MSG_USERNAME_INVALID } from "@/constants/messages.js";

const okPassword = "x".repeat(MIN_PASSWORD_LENGTH);

describe("credentials", () => {
  it("rejects username shorter than minimum length", () => {
    const r = validateSignupInput({
      email: "a@b.co",
      password: okPassword,
      username: "ab",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(MSG_USERNAME_INVALID);
    }
  });
});
