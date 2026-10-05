import { describe, expect, it } from "bun:test";
import {
  escapeHtml,
  isPathTraversal,
  safeJoinPath,
  sanitizeStrings,
  stripHtml,
} from "@/security/sanitize.js";
import {
  checkOutboundUrl,
  isSafeOutboundUrl,
  SSRF_REASON_HOST,
  SSRF_REASON_INVALID,
  SSRF_REASON_PRIVATE,
  SSRF_REASON_PROTOCOL,
} from "@/security/ssrf.js";

describe("html sanitization", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml('<a href="x">&\'')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;",
    );
  });

  it("strips tags, control characters and surrounding whitespace", () => {
    expect(stripHtml("  <b>hi</b>\u0000\nthere ")).toBe("hithere");
  });

  it("recursively sanitizes strings in objects and arrays", () => {
    const input = {
      name: "<b>Bob</b>",
      tags: ["<i>a</i>", { nested: "<script>x</script>" }],
      count: 3,
      flag: true,
    };
    expect(sanitizeStrings(input)).toEqual({
      name: "Bob",
      tags: ["a", { nested: "x" }],
      count: 3,
      flag: true,
    });
  });

  it("stops recursing past maxDepth", () => {
    const deep = { a: { b: { c: "<b>kept</b>" } } };
    const result = sanitizeStrings(deep, 1) as typeof deep;
    expect(result.a.b.c).toBe("<b>kept</b>");
  });
});

describe("path traversal defenses", () => {
  it("rejects traversal and absolute user paths", () => {
    expect(isPathTraversal("../secrets")).toBe(true);
    expect(isPathTraversal("..%2Fsecrets")).toBe(true);
    expect(isPathTraversal("/etc/passwd")).toBe(true);
    expect(isPathTraversal("C:\\Windows")).toBe(true);
    expect(isPathTraversal("a/b.txt")).toBe(false);
  });

  it("keeps resolved paths inside the root", () => {
    expect(safeJoinPath("/srv/root", "a/b.txt")).toBe("/srv/root/a/b.txt");
    expect(safeJoinPath("/srv/root", "../etc/passwd")).toBeNull();
    expect(safeJoinPath("/srv/root", "/etc/passwd")).toBeNull();
  });
});

describe("ssrf outbound check", () => {
  it("allows public https and rejects other protocols", () => {
    expect(checkOutboundUrl("https://example.com/x").ok).toBe(true);
    const http = checkOutboundUrl("http://example.com/x");
    expect(http).toEqual({ ok: false, reason: SSRF_REASON_PROTOCOL });
    expect(
      isSafeOutboundUrl("http://example.com/x", { allowedProtocols: ["http:"] }),
    ).toBe(true);
  });

  it("rejects malformed urls", () => {
    expect(checkOutboundUrl("not a url")).toEqual({
      ok: false,
      reason: SSRF_REASON_INVALID,
    });
  });

  it("blocks loopback and private ranges unless allowed", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]", "api.localhost"]) {
      expect(checkOutboundUrl(`https://${host}/`).reason).toBe(
        SSRF_REASON_PRIVATE,
      );
    }
    for (const host of [
      "10.0.0.5",
      "192.168.1.1",
      "172.16.0.1",
      "172.31.9.9",
      "169.254.1.1",
      "0.0.0.0",
      "db.internal",
    ]) {
      expect(checkOutboundUrl(`https://${host}/`).reason).toBe(
        SSRF_REASON_PRIVATE,
      );
    }
    expect(
      checkOutboundUrl("https://127.0.0.1/", { allowLoopback: true }).ok,
    ).toBe(true);
    expect(
      checkOutboundUrl("https://10.0.0.5/", { allowPrivate: true }).ok,
    ).toBe(true);
  });

  it("enforces exact and wildcard host allowlists case-insensitively", () => {
    const options = { allowedHosts: ["hooks.example.com", "*.trusted.io"] };
    expect(checkOutboundUrl("https://hooks.example.com/x", options).ok).toBe(true);
    expect(checkOutboundUrl("https://sub.trusted.io/x", options).ok).toBe(true);
    expect(checkOutboundUrl("https://trusted.io/x", options).ok).toBe(true);
    expect(checkOutboundUrl("https://evil.io/x", options)).toEqual({
      ok: false,
      reason: SSRF_REASON_HOST,
    });
    expect(
      checkOutboundUrl("https://HOOKS.EXAMPLE.COM/x", options).ok,
    ).toBe(true);
  });
});
