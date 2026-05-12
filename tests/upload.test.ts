import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_PAYLOAD_TOO_LARGE,
} from "@/constants/http-status.js";
import {
  MSG_PAYLOAD_TOO_LARGE,
  MSG_UPLOAD_INVALID_MULTIPART,
  MSG_UPLOAD_NO_FILE,
} from "@/constants/messages.js";
import { UPLOAD_BASE_PATH } from "@/constants/routes.js";
import {
  UPLOAD_FORM_FIELD_NAME,
  UPLOAD_MAX_BYTES,
} from "@/constants/upload.js";
import { createMemoryApp } from "./helpers/app-memory.js";

describe("upload", () => {
  it("stores multipart file and returns metadata", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hono-upload-"));
    const { app } = await createMemoryApp({ uploadDir: dir });
    const fd = new FormData();
    fd.set(
      UPLOAD_FORM_FIELD_NAME,
      new File([new TextEncoder().encode("hello")], "note.txt", {
        type: "text/plain",
      }),
    );
    const res = await app.request(UPLOAD_BASE_PATH, {
      method: "POST",
      body: fd,
    });
    expect(res.status).toBe(HTTP_STATUS_CREATED);
    const body = (await res.json()) as { storedName?: string; size?: number };
    expect(body.size).toBe(5);
    expect(body.storedName).toMatch(/^[0-9a-f-]+_note\.txt$/i);
    expect(existsSync(path.join(dir, body.storedName ?? ""))).toBe(true);
  });

  it("rejects when file field is not a file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hono-upload-"));
    const { app } = await createMemoryApp({ uploadDir: dir });
    const fd = new FormData();
    fd.set(UPLOAD_FORM_FIELD_NAME, "text only");
    const res = await app.request(UPLOAD_BASE_PATH, {
      method: "POST",
      body: fd,
    });
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_UPLOAD_NO_FILE);
  });

  it("rejects oversized file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hono-upload-"));
    const { app } = await createMemoryApp({ uploadDir: dir });
    const big = new Uint8Array(UPLOAD_MAX_BYTES + 1);
    const fd = new FormData();
    fd.set(UPLOAD_FORM_FIELD_NAME, new File([big], "big.bin"));
    const res = await app.request(UPLOAD_BASE_PATH, {
      method: "POST",
      body: fd,
    });
    expect(res.status).toBe(HTTP_STATUS_PAYLOAD_TOO_LARGE);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_PAYLOAD_TOO_LARGE);
  });

  it("rejects invalid multipart body", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hono-upload-"));
    const { app } = await createMemoryApp({ uploadDir: dir });
    const res = await app.request(UPLOAD_BASE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_UPLOAD_INVALID_MULTIPART);
  });
});
