/** Env override for upload storage root (absolute or cwd-relative). */
export const ENV_UPLOAD_DIR_KEY = "UPLOAD_DIR" as const;

/** Default upload directory under `process.cwd()` when env and options unset. */
export const DEFAULT_UPLOAD_DIR_RELATIVE = "data/uploads" as const;

/** Multipart form field name for the binary payload. */
export const UPLOAD_FORM_FIELD_NAME = "file" as const;

/** Maximum accepted file size in bytes. */
export const UPLOAD_MAX_BYTES = 5_242_880 as const;

/** Max length preserved from the client-provided filename segment. */
export const UPLOAD_MAX_FILENAME_CHARS = 200 as const;
