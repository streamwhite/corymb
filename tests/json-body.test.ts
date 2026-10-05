import { describe, expect, it } from "bun:test";
import { MAX_JSON_BODY_BYTES } from "@/constants/http-security.js";
import { MSG_INVALID_JSON, MSG_PAYLOAD_TOO_LARGE } from "@/constants/messages.js";
import { readJsonUnknown } from "@/http/json-body.js";

function jsonRequest(body: string, headers?: HeadersInit): Request {
  return new Request("http://x.test/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("readJsonUnknown", () => {
  it("parses a valid JSON body", async () => {
    const result = await readJsonUnknown(jsonRequest(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects invalid JSON with a bad-request result", async () => {
    const result = await readJsonUnknown(jsonRequest("{not json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(MSG_INVALID_JSON);
    }
  });

  it("rejects when Content-Length exceeds the limit", async () => {
    const req = jsonRequest("{}", {
      "content-length": String(MAX_JSON_BODY_BYTES + 1),
    });
    const result = await readJsonUnknown(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
      expect(result.error).toBe(MSG_PAYLOAD_TOO_LARGE);
    }
  });

  it("rejects an oversized body when Content-Length is absent", async () => {
    const oversized = {
      headers: new Headers(),
      text: async () => "x".repeat(MAX_JSON_BODY_BYTES + 1),
    } as unknown as Request;
    const result = await readJsonUnknown(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
      expect(result.error).toBe(MSG_PAYLOAD_TOO_LARGE);
    }
  });
});
