import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_PAYLOAD_TOO_LARGE,
} from "@/constants/http-status.js";
import {
  MSG_PAYLOAD_TOO_LARGE,
  MSG_UPLOAD_INVALID_MULTIPART,
  MSG_UPLOAD_NO_FILE,
} from "@/constants/messages.js";
import { ValidationError } from "@/errors/app-error.js";
import {
  UPLOAD_FORM_FIELD_NAME,
  UPLOAD_MAX_BYTES,
} from "@/constants/upload.js";

export type UploadedFile = {
  field: string;
  filename: string;
  contentType: string | null;
  size: number;
  bytes: Uint8Array;
};

export type ParsedUpload = {
  file: UploadedFile;
  fields: Record<string, string>;
};

export type ParseUploadOptions = {
  /** Form field name holding the file (default `file`). */
  field?: string;
  /** Max accepted size in bytes (default 5 MiB). */
  maxBytes?: number;
  /** Also parse non-file fields into `fields`. */
  parseFields?: boolean;
};

async function readMultipart(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new ValidationError(MSG_UPLOAD_INVALID_MULTIPART);
  }
}

function sizeError(): never {
  throw new ValidationError(MSG_PAYLOAD_TOO_LARGE);
}

function extractFields(form: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
    }
  }
  return fields;
}

/**
 * Parses a multipart request into a file plus optional text fields. Enforces a
 * size cap before buffering and throws `ValidationError` for bad requests so the
 * error middleware renders the right status.
 */
export async function parseMultipartUpload(
  req: Request,
  options: ParseUploadOptions = {},
): Promise<ParsedUpload> {
  const field = options.field ?? UPLOAD_FORM_FIELD_NAME;
  const maxBytes = options.maxBytes ?? UPLOAD_MAX_BYTES;
  const form = await readMultipart(req);
  const value = form.get(field);
  if (!(value instanceof File)) {
    throw new ValidationError(MSG_UPLOAD_NO_FILE);
  }
  if (value.size > maxBytes) {
    sizeError();
  }
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    sizeError();
  }
  return {
    file: {
      field,
      filename: value.name,
      contentType: value.type === "" ? null : value.type,
      size: bytes.byteLength,
      bytes,
    },
    fields: options.parseFields === false ? {} : extractFields(form),
  };
}

/** True when the request looks like multipart form data. */
export function isMultipart(req: Request): boolean {
  const type = req.headers.get("Content-Type") ?? "";
  return type.toLowerCase().includes("multipart/form-data");
}

export { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_PAYLOAD_TOO_LARGE };
