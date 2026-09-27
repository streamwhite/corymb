import type {
  ObjectStorage,
  PutObjectInput,
  PutObjectResult,
  StoredObject,
} from "@/storage/storage-types.js";

/** In-memory object storage for tests and local development. */
export function createMemoryStorage(): ObjectStorage {
  const objects = new Map<string, Uint8Array>();
  const types = new Map<string, string | null>();

  function headOf(key: string): StoredObject | null {
    const body = objects.get(key);
    if (body === undefined) {
      return null;
    }
    return { key, size: body.byteLength, contentType: types.get(key) ?? null };
  }

  return {
    driver: "memory",
    async put(input: PutObjectInput): Promise<PutObjectResult> {
      const copy = Uint8Array.from(input.body);
      objects.set(input.key, copy);
      types.set(input.key, input.contentType ?? null);
      return {
        key: input.key,
        size: copy.byteLength,
        contentType: input.contentType ?? null,
      };
    },
    async get(key: string): Promise<Uint8Array | null> {
      const body = objects.get(key);
      return body === undefined ? null : Uint8Array.from(body);
    },
    async head(key: string): Promise<StoredObject | null> {
      return headOf(key);
    },
    async delete(key: string): Promise<void> {
      objects.delete(key);
      types.delete(key);
    },
  };
}
