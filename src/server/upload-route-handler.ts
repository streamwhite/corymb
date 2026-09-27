import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_INTERNAL,
  HTTP_STATUS_PAYLOAD_TOO_LARGE,
} from "@/constants/http-status.js";
import {
  MSG_INTERNAL,
  MSG_PAYLOAD_TOO_LARGE,
  MSG_UPLOAD_INVALID_MULTIPART,
  MSG_UPLOAD_NO_FILE,
} from "@/constants/messages.js";
import {
  UPLOAD_FORM_FIELD_NAME,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_FILENAME_CHARS,
} from "@/constants/upload.js";
import { jsonApiResponse } from "@/http/json-response.js";
import type { ObjectStorage } from "@/storage/storage-types.js";

export type UploadRouteContext = {
  storage: ObjectStorage;
  /** Object key prefix inside the bucket/root. */
  keyPrefix?: string;
};

const FALLBACK_STORED_NAME = "upload.bin" as const;

function safeStoredBase(name: string): string {
  const base = name.replace(/^.*[/\\]/u, "");
  const cleaned = base.replace(/[^\w.\- ]/gu, "_").trim();
  const clipped = cleaned.slice(0, UPLOAD_MAX_FILENAME_CHARS);
  return clipped.length > 0 ? clipped : FALLBACK_STORED_NAME;
}

function storedObjectName(prefix: string, originalName: string): string {
  const name = `${crypto.randomUUID()}_${safeStoredBase(originalName)}`;
  return prefix.length > 0 ? `${prefix.replace(/\/+$/u, "")}/${name}` : name;
}

function getUploadFile(form: FormData): File | null {
  const value = form.get(UPLOAD_FORM_FIELD_NAME);
  return value instanceof File ? value : null;
}

async function readMultipartForm(req: Request): Promise<FormData | null> {
  try {
    return await req.formData();
  } catch {
    return null;
  }
}

export async function handleFileUpload(
  req: Request,
  ctx: UploadRouteContext,
): Promise<Response> {
  const url = new URL(req.url);
  const form = await readMultipartForm(req);
  if (form === null) {
    return jsonApiResponse(
      { error: MSG_UPLOAD_INVALID_MULTIPART },
      { status: HTTP_STATUS_BAD_REQUEST },
      url,
    );
  }
  const file = getUploadFile(form);
  if (file === null) {
    return jsonApiResponse(
      { error: MSG_UPLOAD_NO_FILE },
      { status: HTTP_STATUS_BAD_REQUEST },
      url,
    );
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return jsonApiResponse(
      { error: MSG_PAYLOAD_TOO_LARGE },
      { status: HTTP_STATUS_PAYLOAD_TOO_LARGE },
      url,
    );
  }
  const key = storedObjectName(ctx.keyPrefix ?? "", file.name);
  try {
    const stored = await ctx.storage.put({
      key,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type === "" ? undefined : file.type,
    });
    return jsonApiResponse(
      {
        ok: true,
        key: stored.key,
        size: stored.size,
        contentType: stored.contentType,
        driver: ctx.storage.driver,
      },
      { status: HTTP_STATUS_CREATED },
      url,
    );
  } catch (err) {
    console.error(err);
    return jsonApiResponse(
      { error: MSG_INTERNAL },
      { status: HTTP_STATUS_INTERNAL },
      url,
    );
  }
}
