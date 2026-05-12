import type { SQL } from "bun";
import {
  type AccessTokenClaims,
  signAccessToken,
  verifyAccessToken,
} from "@/auth/jwt.js";
import { issueSession, parseBearerSessionToken } from "@/auth/session.js";
import {
  RESPONSE_FIELD_ACCESS_TOKEN,
  RESPONSE_FIELD_REFRESH_TOKEN,
} from "@/constants/auth.js";
import { HEADER_AUTHORIZATION } from "@/constants/http-security.js";
import { HTTP_STATUS_UNAUTHORIZED } from "@/constants/http-status.js";
import {
  MSG_ACCESS_TOKEN_INVALID,
  MSG_ACCESS_TOKEN_REQUIRED,
} from "@/constants/messages.js";
import { jsonApiResponse } from "@/http/json-response.js";

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

export function userPayload(user: {
  id: string;
  email: string;
  username: string;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
  };
}

export async function issueSessionTokens(
  sql: SQL,
  userId: string,
): Promise<SessionTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId),
    issueSession(sql, userId),
  ]);
  return { accessToken, refreshToken };
}

export function tokensResponseBody(
  user: { id: string; email: string; username: string },
  tokens: SessionTokens,
) {
  return {
    user: userPayload(user),
    [RESPONSE_FIELD_ACCESS_TOKEN]: tokens.accessToken,
    [RESPONSE_FIELD_REFRESH_TOKEN]: tokens.refreshToken,
  };
}

export type AccessTokenGuard =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false; response: Response };

export async function requireAccessToken(
  req: Request,
): Promise<AccessTokenGuard> {
  const bearer = parseBearerSessionToken(req.headers.get(HEADER_AUTHORIZATION));
  if (bearer === null) {
    return {
      ok: false,
      response: jsonApiResponse(
        { error: MSG_ACCESS_TOKEN_REQUIRED },
        { status: HTTP_STATUS_UNAUTHORIZED },
        new URL(req.url),
      ),
    };
  }
  const verified = await verifyAccessToken(bearer);
  if (!verified.ok) {
    return {
      ok: false,
      response: jsonApiResponse(
        { error: MSG_ACCESS_TOKEN_INVALID },
        { status: HTTP_STATUS_UNAUTHORIZED },
        new URL(req.url),
      ),
    };
  }
  return { ok: true, claims: verified.claims };
}
