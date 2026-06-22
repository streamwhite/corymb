import type { SQL } from "bun";
import { consumeRefreshToken } from "@/auth/session.js";
import type { Cache } from "@/cache/cache-types.js";
import {
  RESPONSE_FIELD_ACCESS_TOKEN,
  RESPONSE_FIELD_REFRESH_TOKEN,
} from "@/constants/auth.js";
import {
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
} from "@/constants/http-status.js";
import { MSG_REFRESH_TOKEN_INVALID } from "@/constants/messages.js";
import { jsonApiResponse } from "@/http/json-response.js";
import { readRefreshTokenFromBody } from "@/server/auth/refresh-body.js";
import { issueSessionTokens } from "@/server/auth/shared.js";

export async function handleAuthRefresh(
  req: Request,
  sql: SQL,
  cache: Cache,
): Promise<Response> {
  const body = await readRefreshTokenFromBody(req);
  if (!body.ok) {
    return body.response;
  }
  const consumed = await consumeRefreshToken(cache, sql, body.refreshToken);
  if (!consumed.ok) {
    return jsonApiResponse(
      { error: MSG_REFRESH_TOKEN_INVALID },
      { status: HTTP_STATUS_UNAUTHORIZED },
      new URL(req.url),
    );
  }
  const tokens = await issueSessionTokens(sql, consumed.userId);
  return jsonApiResponse(
    {
      [RESPONSE_FIELD_ACCESS_TOKEN]: tokens.accessToken,
      [RESPONSE_FIELD_REFRESH_TOKEN]: tokens.refreshToken,
    },
    { status: HTTP_STATUS_OK },
    new URL(req.url),
  );
}
