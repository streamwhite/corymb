import { s3 } from "bun";
import type {
  ObjectStorage,
  PresignOptions,
  PutObjectInput,
  PutObjectResult,
  StoredObject,
} from "@/storage/storage-types.js";

const DEFAULT_PRESIGN_EXPIRES_SECONDS = 3600;

export type S3StorageOptions = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Virtual-hosted style endpoint (e.g. R2/Spaces custom domains). */
  virtualHostedStyle?: boolean;
};

function fileOptions(options: S3StorageOptions, contentType?: string) {
  return {
    bucket: options.bucket,
    region: options.region,
    ...(options.endpoint === undefined ? {} : { endpoint: options.endpoint }),
    ...(options.accessKeyId === undefined
      ? {}
      : { accessKeyId: options.accessKeyId }),
    ...(options.secretAccessKey === undefined
      ? {}
      : { secretAccessKey: options.secretAccessKey }),
    ...(contentType === undefined ? {} : { type: contentType }),
  };
}

async function readObject(
  options: S3StorageOptions,
  key: string,
): Promise<Uint8Array | null> {
  const file = s3.file(key, fileOptions(options));
  if (!(await file.exists())) {
    return null;
  }
  return new Uint8Array(await file.arrayBuffer());
}

/** S3-compatible object storage backed by Bun's built-in `s3` client. */
export function createS3Storage(options: S3StorageOptions): ObjectStorage {
  return {
    driver: "s3",
    async put(input: PutObjectInput): Promise<PutObjectResult> {
      const file = s3.file(input.key, fileOptions(options, input.contentType));
      const size = await file.write(input.body);
      return {
        key: input.key,
        size,
        contentType: input.contentType ?? null,
      };
    },
    async get(key: string): Promise<Uint8Array | null> {
      return readObject(options, key);
    },
    async head(key: string): Promise<StoredObject | null> {
      const file = s3.file(key, fileOptions(options));
      if (!(await file.exists())) {
        return null;
      }
      const info = await file.stat();
      return {
        key,
        size: Number(info.size),
        contentType: info.type === "" ? null : info.type,
      };
    },
    async delete(key: string): Promise<void> {
      await s3.file(key, fileOptions(options)).delete();
    },
    presign(key: string, opts?: PresignOptions): string {
      return s3.file(key, fileOptions(options, opts?.contentType)).presign({
        method: opts?.method ?? "GET",
        expiresIn: opts?.expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRES_SECONDS,
      });
    },
  };
}
