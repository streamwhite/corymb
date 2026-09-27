/** Storage backend kind selected from env or options. */
export const STORAGE_DRIVER_S3 = "s3" as const;
export const STORAGE_DRIVER_FILESYSTEM = "filesystem" as const;
export const STORAGE_DRIVER_MEMORY = "memory" as const;

export type StorageDriver =
  | typeof STORAGE_DRIVER_S3
  | typeof STORAGE_DRIVER_FILESYSTEM
  | typeof STORAGE_DRIVER_MEMORY;

export const ENV_STORAGE_DRIVER = "STORAGE_DRIVER" as const;
export const ENV_S3_BUCKET = "S3_BUCKET" as const;
export const ENV_S3_REGION = "S3_REGION" as const;
export const ENV_S3_ENDPOINT = "S3_ENDPOINT" as const;
export const ENV_S3_ACCESS_KEY_ID = "S3_ACCESS_KEY_ID" as const;
export const ENV_S3_SECRET_ACCESS_KEY = "S3_SECRET_ACCESS_KEY" as const;

export const DEFAULT_S3_REGION = "us-east-1" as const;

export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType?: string;
};

export type PutObjectResult = {
  key: string;
  size: number;
  contentType: string | null;
};

export type PresignOptions = {
  method?: "GET" | "PUT";
  expiresInSeconds?: number;
  contentType?: string;
};

export type StoredObject = {
  key: string;
  size: number;
  contentType: string | null;
};

/** Object storage abstraction, implemented by S3, filesystem and memory drivers. */
export type ObjectStorage = {
  readonly driver: StorageDriver;
  put: (input: PutObjectInput) => Promise<PutObjectResult>;
  get: (key: string) => Promise<Uint8Array | null>;
  head: (key: string) => Promise<StoredObject | null>;
  delete: (key: string) => Promise<void>;
  /** Presigned URL; only supported by drivers with an external HTTP surface. */
  presign?: (key: string, options?: PresignOptions) => string;
};

export type CreateStorageOptions = {
  driver?: StorageDriver;
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Filesystem root when `driver` is `filesystem`. */
  rootDir?: string;
  /** Public base URL prepended to filenames for `put` results/presigns. */
  publicBaseUrl?: string;
};
