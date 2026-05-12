import { describe, expect, it } from "bun:test";
import { parseBearerSessionToken } from "@/auth/session.js";
import { AUTH_BEARER_HEADER_PREFIX } from "@/constants/auth.js";

describe("parseBearerSessionToken", () => {
  it("returns token after Bearer prefix", () => {
    const inner = "abc.def-hex";
    expect(
      parseBearerSessionToken(`${AUTH_BEARER_HEADER_PREFIX}${inner}`),
    ).toBe(inner);
  });

  it("returns null for missing or non-Bearer header", () => {
    expect(parseBearerSessionToken(null)).toBeNull();
    expect(parseBearerSessionToken("")).toBeNull();
    expect(parseBearerSessionToken("Basic xyz")).toBeNull();
    expect(parseBearerSessionToken(`${AUTH_BEARER_HEADER_PREFIX}`)).toBeNull();
    expect(
      parseBearerSessionToken(`${AUTH_BEARER_HEADER_PREFIX}   `),
    ).toBeNull();
  });
});
