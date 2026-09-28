import { randomBytes } from "node:crypto";
import { HEADER_COOKIE, HEADER_SET_COOKIE } from "@/constants/http-security.js";
import { MSG_CSRF_INVALID } from "@/constants/messages.js";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_SAFE_METHODS,
  CSRF_TOKEN_BYTES,
  resolveCsrfTtlSecondsFromEnv,
} from "@/constants/security.js";
import { ForbiddenError } from "@/errors/app-error.js";
import {
  readCookieValue,
  serializeCookie,
  verifySignature,
} from "@/http/cookies.js";
import type { Middleware } from "@/middleware/middleware-types.js";

const DEFAULT_COOKIE_PATH = "/" as const;

export type CsrfOptions = {
  cookieName?: string;
  headerName?: string;
  /** Methods that do not require a token (default GET/HEAD/OPTIONS). */
  safeMethods?: readonly string[];
  ttlSeconds?: number;
  path?: string;
  /** Force the `Secure` flag; defaults to the request protocol. */
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
};

/** Generates a URL-safe random CSRF token. */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString("base64url");
}

/** Reads the current CSRF token from the request cookie, if any. */
export function readCsrfToken(
  req: Request,
  cookieName = CSRF_COOKIE_NAME,
): string | undefined {
  return readCookieValue(req.headers.get(HEADER_COOKIE), cookieName);
}

function setCsrfCookie(
  res: Response,
  token: string,
  options: CsrfOptions,
): Response {
  const headers = new Headers(res.headers);
  headers.append(
    HEADER_SET_COOKIE,
    serializeCookie(options.cookieName ?? CSRF_COOKIE_NAME, token, {
      path: options.path ?? DEFAULT_COOKIE_PATH,
      maxAgeSeconds: options.ttlSeconds ?? resolveCsrfTtlSecondsFromEnv(),
      secure: options.secure,
      sameSite: options.sameSite,
    }),
  );
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function isTokenValid(
  headerToken: string | null,
  cookieToken: string | undefined,
): boolean {
  if (headerToken === null || cookieToken === undefined || cookieToken.length === 0) {
    return false;
  }
  return verifySignature(headerToken, cookieToken);
}

/**
 * Stateless double-submit CSRF protection: safe requests receive a token
 * cookie; unsafe requests must echo it in the CSRF header. The cookie is not
 * `HttpOnly` because the client must read it.
 */
export function withCsrf(options: CsrfOptions = {}): Middleware {
  const cookieName = options.cookieName ?? CSRF_COOKIE_NAME;
  const headerName = options.headerName ?? CSRF_HEADER_NAME;
  const safeMethods = options.safeMethods ?? CSRF_SAFE_METHODS;

  return async (ctx, next) => {
    const cookieToken = readCsrfToken(ctx.req, cookieName);
    if (safeMethods.includes(ctx.req.method.toUpperCase())) {
      const res = await next();
      if (cookieToken !== undefined) {
        return res;
      }
      const secure = options.secure ?? ctx.url.protocol === "https:";
      return setCsrfCookie(res, generateCsrfToken(), {
        ...options,
        cookieName,
        secure,
      });
    }
    const headerToken = ctx.req.headers.get(headerName);
    if (!isTokenValid(headerToken, cookieToken)) {
      throw new ForbiddenError(MSG_CSRF_INVALID);
    }
    return next();
  };
}
