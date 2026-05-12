import {
  HEADER_CONTENT_LENGTH,
  MAX_JSON_BODY_BYTES,
} from "@/constants/http-security.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_PAYLOAD_TOO_LARGE,
} from "@/constants/http-status.js";
import {
  MSG_INVALID_JSON,
  MSG_PAYLOAD_TOO_LARGE,
} from "@/constants/messages.js";

const RADIX_DECIMAL = 10 as const;

export type ReadJsonUnknownResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; status: number };

function exceedsContentLengthHeader(
  contentLength: string | null,
  maxBytes: number,
): boolean {
  if (contentLength === null || contentLength.length === 0) {
    return false;
  }
  const n = Number.parseInt(contentLength, RADIX_DECIMAL);
  return Number.isFinite(n) && n > maxBytes;
}

export async function readJsonUnknown(
  req: Request,
): Promise<ReadJsonUnknownResult> {
  const max = MAX_JSON_BODY_BYTES;
  if (exceedsContentLengthHeader(req.headers.get(HEADER_CONTENT_LENGTH), max)) {
    return {
      ok: false,
      error: MSG_PAYLOAD_TOO_LARGE,
      status: HTTP_STATUS_PAYLOAD_TOO_LARGE,
    };
  }
  try {
    const text = await req.text();
    if (text.length > max) {
      return {
        ok: false,
        error: MSG_PAYLOAD_TOO_LARGE,
        status: HTTP_STATUS_PAYLOAD_TOO_LARGE,
      };
    }
    const raw = JSON.parse(text) as unknown;
    return { ok: true, value: raw };
  } catch {
    return {
      ok: false,
      error: MSG_INVALID_JSON,
      status: HTTP_STATUS_BAD_REQUEST,
    };
  }
}
