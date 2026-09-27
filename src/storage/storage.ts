import { readEnv } from "@/config/env.js";
import { createFilesystemStorage } from "@/storage/filesystem-storage.js";
import { createMemoryStorage } from "@/storage/memory-storage.js";
import { createS3Storage } from "@/storage/s3-storage.js";
import {
  DEFAULT_S3_REGION,
  ENV_S3_ACCESS_KEY_ID,
  ENV_S3_BUCKET,
  ENV_S3_ENDPOINT,
  ENV_S3_REGION,
  ENV_S3_SECRET_ACCESS_KEY,
  ENV_STORAGE_DRIVER,
  type CreateStorageOptions,
  type ObjectStorage,
  STORAGE_DRIVER_FILESYSTEM,
  STORAGE_DRIVER_MEMORY,
  STORAGE_DRIVER_S3,
  type StorageDriver,
} from "@/storage/storage-types.js";

export type { CreateStorageOptions } from "@/storage/storage-types.js";

function resolveDriver(options: CreateStorageOptions): StorageDriver {
  if (options.driver !== undefined) {
    return options.driver;
  }
  const fromEnv = readEnv(ENV_STORAGE_DRIVER);
  if (fromEnv === STORAGE_DRIVER_S3 || fromEnv === STORAGE_DRIVER_MEMORY) {
    return fromEnv;
  }
  return STORAGE_DRIVER_FILESYSTEM;
}

function buildS3(options: CreateStorageOptions): ObjectStorage {
  const bucket = options.bucket ?? readEnv(ENV_S3_BUCKET);
  if (bucket === undefined) {
    throw new Error(`${ENV_S3_BUCKET} is required when STORAGE_DRIVER=s3`);
  }
  return createS3Storage({
    bucket,
    region: options.region ?? readEnv(ENV_S3_REGION) ?? DEFAULT_S3_REGION,
    endpoint: options.endpoint ?? readEnv(ENV_S3_ENDPOINT),
    accessKeyId: options.accessKeyId ?? readEnv(ENV_S3_ACCESS_KEY_ID),
    secretAccessKey:
      options.secretAccessKey ?? readEnv(ENV_S3_SECRET_ACCESS_KEY),
  });
}

/**
 * Resolves the configured object storage driver. Defaults to the filesystem
 * root (`rootDir`); set `STORAGE_DRIVER=s3` (with `S3_BUCKET`) for S3 or a
 * compatible service.
 */
export function createObjectStorage(
  options: CreateStorageOptions & { rootDir: string },
): ObjectStorage {
  const driver = resolveDriver(options);
  if (driver === STORAGE_DRIVER_S3) {
    return buildS3(options);
  }
  if (driver === STORAGE_DRIVER_MEMORY) {
    return createMemoryStorage();
  }
  return createFilesystemStorage(options.rootDir);
}
