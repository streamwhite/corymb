import { SESSION_COOKIE_NAME } from "@/constants/auth.js";

export function cookieHeaderFromSetCookie(
  setCookieHeader: string | null,
): Record<string, string> | undefined {
  if (setCookieHeader === null || setCookieHeader.length === 0) {
    return undefined;
  }
  const cookieRegex = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`);
  const match = cookieRegex.exec(setCookieHeader);
  if (match?.[1] === undefined) {
    return undefined;
  }
  return {
    Cookie: `${SESSION_COOKIE_NAME}=${match[1]}`,
  };
}
