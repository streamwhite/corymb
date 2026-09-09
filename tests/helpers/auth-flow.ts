import { BETTER_AUTH_BASE_PATH } from "@/constants/better-auth.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "../constants.js";

export const BA_SIGN_UP_PATH =
  `${BETTER_AUTH_BASE_PATH}/sign-up/email` as const;
export const BA_SIGN_IN_PATH =
  `${BETTER_AUTH_BASE_PATH}/sign-in/email` as const;
export const BA_SIGN_OUT_PATH = `${BETTER_AUTH_BASE_PATH}/sign-out` as const;
export const BA_GET_SESSION_PATH =
  `${BETTER_AUTH_BASE_PATH}/get-session` as const;
export const BA_REQUEST_PASSWORD_RESET_PATH =
  `${BETTER_AUTH_BASE_PATH}/request-password-reset` as const;
export const BA_RESET_PASSWORD_PATH =
  `${BETTER_AUTH_BASE_PATH}/reset-password` as const;
export const BA_SEND_VERIFICATION_EMAIL_PATH =
  `${BETTER_AUTH_BASE_PATH}/send-verification-email` as const;
export const BA_TOKEN_PATH = `${BETTER_AUTH_BASE_PATH}/token` as const;

export const SET_AUTH_TOKEN_HEADER = "set-auth-token" as const;

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

export type SignupResult = {
  status: number;
  body: unknown;
  token: string | null;
  cookies: string;
};

function mergeSetCookies(existing: string, setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const raw of setCookies) {
    const first = raw.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    map.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export async function signupUser(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  input: { email: string; username: string; password: string },
): Promise<SignupResult> {
  const res = await request(BA_SIGN_UP_PATH, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      name: input.username,
      username: input.username,
    }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const token = res.headers.get(SET_AUTH_TOKEN_HEADER);
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return {
    status: res.status,
    body,
    token,
    cookies: mergeSetCookies("", setCookies),
  };
}

export function bearerHeaders(token: string): Record<string, string> {
  return {
    ...jsonHeaders,
    Authorization: `Bearer ${token}`,
  };
}
