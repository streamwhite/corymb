import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFilesystemStorage } from "@/storage/filesystem-storage.js";
import { createMemoryStorage } from "@/storage/memory-storage.js";
import { createObjectStorage } from "@/storage/storage.js";

const BODY = new TextEncoder().encode("hello world");

describe("object storage drivers", () => {
  it("memory driver round-trips put/get/head/delete", async () => {
    const storage = createMemoryStorage();
    const stored = await storage.put({
      key: "a/b.txt",
      body: BODY,
      contentType: "text/plain",
    });
    expect(stored).toMatchObject({ key: "a/b.txt", size: 11 });
    const got = await storage.get("a/b.txt");
    expect(new TextDecoder().decode(got ?? new Uint8Array())).toBe("hello world");
    expect(await storage.head("a/b.txt")).toMatchObject({ size: 11 });
    await storage.delete("a/b.txt");
    expect(await storage.get("a/b.txt")).toBeNull();
  });

  it("filesystem driver round-trips and isolates keys", async () => {
    const root = mkdtempSync(join(tmpdir(), "storage-fs-"));
    const storage = createFilesystemStorage(root);
    await storage.put({ key: "nested/file.bin", body: BODY });
    const got = await storage.get("nested/file.bin");
    expect(new TextDecoder().decode(got ?? new Uint8Array())).toBe("hello world");
    expect(await storage.head("nested/file.bin")).toMatchObject({ size: 11 });
    await storage.delete("nested/file.bin");
    expect(await storage.head("nested/file.bin")).toBeNull();
  });

  it("selects driver from options/env", () => {
    const root = mkdtempSync(join(tmpdir(), "storage-sel-"));
    expect(createObjectStorage({ rootDir: root, driver: "memory" }).driver).toBe(
      "memory",
    );
    expect(
      createObjectStorage({ rootDir: root, driver: "filesystem" }).driver,
    ).toBe("filesystem");
  });

  it("requires S3_BUCKET when driver is s3", () => {
    expect(() =>
      createObjectStorage({
        rootDir: "/tmp/x",
        driver: "s3",
        bucket: undefined,
      }),
    ).toThrow(/S3_BUCKET/);
  });
});
