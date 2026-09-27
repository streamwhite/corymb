import { describe, expect, it } from "bun:test";
import {
  parseCookies,
  readCookieValue,
  readSignedCookie,
  serializeClearedCookie,
  serializeCookie,
  signCookieValue,
  verifyCookieValue,
} from "@/http/cookies.js";

describe("cookies", () => {
  it("reads and parses the Cookie header", () => {
    const header = "a=1; b=hello%20world; c=3";
    expect(readCookieValue(header, "b")).toBe("hello world");
    expect(readCookieValue(header, "missing")).toBeUndefined();
    expect(parseCookies(header)).toEqual({ a: "1", b: "hello world", c: "3" });
  });

  it("serializes cookies with attributes", () => {
    const header = serializeCookie("sid", "abc", {
      maxAgeSeconds: 60,
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    });
    expect(header).toContain("sid=abc");
    expect(header).toContain("Path=/");
    expect(header).toContain("Max-Age=60");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Strict");
  });

  it("clears a cookie with Max-Age=0", () => {
    expect(serializeClearedCookie("sid")).toContain("sid=;");
    expect(serializeClearedCookie("sid")).toContain("Max-Age=0");
  });

  it("signs and verifies values", () => {
    const secret = "super-secret-key";
    const signed = signCookieValue("user-1", secret);
    expect(verifyCookieValue(signed, secret)).toBe("user-1");
    expect(verifyCookieValue(signed, "wrong")).toBeUndefined();
    expect(verifyCookieValue(`${signed}tampered`, secret)).toBeUndefined();
    expect(readSignedCookie(`sid=${encodeURIComponent(signed)}`, "sid", { secret })).toBe(
      "user-1",
    );
  });
});
