import { describe, expect, it } from "bun:test";
import { ValidationError } from "@/errors/app-error.js";
import { isMultipart, parseMultipartUpload } from "@/http/multipart.js";

function multipartRequest(
  files: Array<{ name: string; content: string; type?: string }>,
  fields?: Record<string, string>,
): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields ?? {})) fd.set(k, v);
  for (const f of files) {
    fd.set(
      "file",
      new File([new TextEncoder().encode(f.content)], f.name, {
        type: f.type ?? "application/octet-stream",
      }),
    );
  }
  return new Request("http://x.test/upload", { method: "POST", body: fd });
}

describe("multipart parsing", () => {
  it("parses the file and text fields", async () => {
    const req = multipartRequest(
      [{ name: "note.txt", content: "hello", type: "text/plain" }],
      { title: "greeting" },
    );
    expect(isMultipart(req)).toBe(true);
    const parsed = await parseMultipartUpload(req);
    expect(parsed.file.filename).toBe("note.txt");
    expect(parsed.file.contentType).toStartWith("text/plain");
    expect(parsed.file.size).toBe(5);
    expect(parsed.fields.title).toBe("greeting");
  });

  it("throws when no file field is present", async () => {
    const fd = new FormData();
    fd.set("file", "not a file");
    const req = new Request("http://x.test/upload", { method: "POST", body: fd });
    await expect(parseMultipartUpload(req)).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces the size cap", async () => {
    const req = multipartRequest([{ name: "big.bin", content: "x".repeat(100) }]);
    await expect(
      parseMultipartUpload(req, { maxBytes: 10 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects non-multipart bodies", async () => {
    const req = new Request("http://x.test/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(isMultipart(req)).toBe(false);
    await expect(parseMultipartUpload(req)).rejects.toBeInstanceOf(ValidationError);
  });
});
