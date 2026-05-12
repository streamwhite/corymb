import {
  MIN_PASSWORD_LENGTH,
  RESPONSE_FIELD_ACCESS_TOKEN,
  RESPONSE_FIELD_REFRESH_TOKEN,
} from "@/constants/auth.js";
import { AUTH_SIGNUP_PATH } from "@/constants/routes.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "../constants.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

export const defaultPassword = "x".repeat(MIN_PASSWORD_LENGTH);

export type SignedUpUser = {
  email: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
};

type SignupResponseShape = {
  user: { id: string; email: string; username: string };
  [RESPONSE_FIELD_ACCESS_TOKEN]: string;
  [RESPONSE_FIELD_REFRESH_TOKEN]: string;
};

export async function signupUser(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  params: { email: string; username: string; password?: string },
): Promise<SignedUpUser> {
  const res = await request(AUTH_SIGNUP_PATH, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      email: params.email,
      username: params.username,
      password: params.password ?? defaultPassword,
    }),
  });
  if (res.status !== 201) {
    throw new Error(`signup failed: ${String(res.status)}`);
  }
  const body = (await res.json()) as SignupResponseShape;
  return {
    email: params.email,
    username: params.username,
    accessToken: body[RESPONSE_FIELD_ACCESS_TOKEN],
    refreshToken: body[RESPONSE_FIELD_REFRESH_TOKEN],
    userId: body.user.id,
  };
}
