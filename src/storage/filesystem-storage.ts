import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ObjectStorage,
  PutObjectInput,
  PutObjectResult,
  StoredObject,
} from "@/storage/storage-types.js";

const CONTENT_TYPE_UNKNOWN = null;

function safeKey(key: string): string {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  return normalized.replace(/^\/+/u, "");
}

/** Local filesystem object storage (default when no bucket is configured). */
export function createFilesystemStorage(rootDir: string): ObjectStorage {
  const resolveKey = (key: string) => path.join(rootDir, safeKey(key));

  return {
    driver: "filesystem",
    async put(input: PutObjectInput): Promise<PutObjectResult> {
      const dest = resolveKey(input.key);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, input.body);
      return {
        key: input.key,
        size: input.body.byteLength,
        contentType: input.contentType ?? CONTENT_TYPE_UNKNOWN,
      };
    },
    async get(key: string): Promise<Uint8Array | null> {
      try {
        const buf = await readFile(resolveKey(key));
        return new Uint8Array(buf);
      } catch {
        return null;
      }
    },
    async head(key: string): Promise<StoredObject | null> {
      try {
        const info = await stat(resolveKey(key));
        return { key, size: info.size, contentType: CONTENT_TYPE_UNKNOWN };
      } catch {
        return null;
      }
    },
    async delete(key: string): Promise<void> {
      await rm(resolveKey(key), { force: true });
    },
  };
}
