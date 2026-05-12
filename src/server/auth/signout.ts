import type { SQL } from "bun";
import { revokeSessionByRawToken } from "@/auth/session.js";
import { HTTP_STATUS_OK } from "@/constants/http-status.js";
import { jsonApiResponse } from "@/http/json-response.js";
import { readRefreshTokenFromBody } from "@/server/auth/refresh-body.js";

export async function handleAuthSignout(
  req: Request,
  sql: SQL,
): Promise<Response> {
  const body = await readRefreshTokenFromBody(req);
  if (body.ok) {
    await revokeSessionByRawToken(sql, body.refreshToken);
  }
  return jsonApiResponse(
    { ok: true },
    { status: HTTP_STATUS_OK },
    new URL(req.url),
  );
}
