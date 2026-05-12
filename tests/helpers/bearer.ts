import { AUTH_BEARER_HEADER_PREFIX } from "@/constants/auth.js";
import { HEADER_AUTHORIZATION } from "@/constants/http-security.js";

export function authorizationBearerHeaders(
  token: string,
): Record<string, string> {
  return {
    [HEADER_AUTHORIZATION]: `${AUTH_BEARER_HEADER_PREFIX}${token}`,
  };
}
