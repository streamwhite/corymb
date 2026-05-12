import { RESPONSE_FIELD_REFRESH_TOKEN } from "@/constants/auth.js";
import { HTTP_STATUS_BAD_REQUEST } from "@/constants/http-status.js";
import { MSG_REFRESH_TOKEN_REQUIRED } from "@/constants/messages.js";
import { readJsonUnknown } from "@/http/json-body.js";
import { jsonApiResponse } from "@/http/json-response.js";

export type ReadRefreshTokenResult =
  | { ok: true; refreshToken: string }
  | { ok: false; response: Response };

function pickRefreshTokenField(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const raw = (value as Record<string, unknown>)[RESPONSE_FIELD_REFRESH_TOKEN];
  return typeof raw === "string" ? raw : undefined;
}

export async function readRefreshTokenFromBody(
  req: Request,
): Promise<ReadRefreshTokenResult> {
  const parsed = await readJsonUnknown(req);
  if (!parsed.ok) {
    return {
      ok: false,
      response: jsonApiResponse(
        { error: parsed.error },
        { status: parsed.status },
        new URL(req.url),
      ),
    };
  }
  const refreshToken = pickRefreshTokenField(parsed.value);
  if (refreshToken === undefined || refreshToken.length === 0) {
    return {
      ok: false,
      response: jsonApiResponse(
        { error: MSG_REFRESH_TOKEN_REQUIRED },
        { status: HTTP_STATUS_BAD_REQUEST },
        new URL(req.url),
      ),
    };
  }
  return { ok: true, refreshToken };
}
