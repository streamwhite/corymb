import { CryptoHasher } from "bun";
import { timingSafeEqual } from "node:crypto";
import { HEADER_COOKIE } from "@/constants/http-security.js";
import type { Middleware } from "@/middleware/middleware-types.js";

const COOKIE_PAIR_SEP = "; " as const;
const COOKIE_KV_SEP = "=" as const;
const SIGNATURE_SEP = "." as const;
const HASH_ALGORITHM = "sha256" as const;

export function readCookieValue(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (cookieHeader === null || cookieHeader.length === 0) {
    return undefined;
  }
  for (const part of cookieHeader.split(COOKIE_PAIR_SEP)) {
    const idx = part.indexOf(COOKIE_KV_SEP);
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

/** Parses the whole `Cookie` header into a plain object. */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (cookieHeader === null || cookieHeader.length === 0) {
    return out;
  }
  for (const part of cookieHeader.split(COOKIE_PAIR_SEP)) {
    const idx = part.indexOf(COOKIE_KV_SEP);
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key.length === 0) continue;
    out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export type CookieOptions = {
  path?: string;
  maxAgeSeconds?: number;
  expires?: Date;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
};

const DEFAULT_PATH = "/" as const;

/** Serializes a `Set-Cookie` header value from options. */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const parts = [`${name}${COOKIE_KV_SEP}${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? DEFAULT_PATH}`);
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${String(options.maxAgeSeconds)}`);
  }
  if (options.expires !== undefined) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

/** Serializes a cookie that clears the value (`Max-Age=0`). */
export function serializeClearedCookie(
  name: string,
  options: CookieOptions = {},
): string {
  return serializeCookie(name, "", { ...options, maxAgeSeconds: 0 });
}

function sign(value: string, secret: string): string {
  const hasher = new CryptoHasher("sha256");
  hasher.update(`${value}${SIGNATURE_SEP}${secret}`);
  return hasher.digest("base64url");
}

/** Signs a value as `value.signature` for tamper detection. */
export function signCookieValue(value: string, secret: string): string {
  return `${value}${SIGNATURE_SEP}${sign(value, secret)}`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Verifies and returns the original value, or `undefined` when tampered. */
export function verifyCookieValue(
  signed: string | undefined,
  secret: string,
): string | undefined {
  if (signed === undefined) {
    return undefined;
  }
  const idx = signed.lastIndexOf(SIGNATURE_SEP);
  if (idx <= 0) {
    return undefined;
  }
  const value = signed.slice(0, idx);
  const signature = signed.slice(idx + 1);
  return safeEqual(signature, sign(value, secret)) ? value : undefined;
}

export type ReadSignedCookieOptions = {
  secret: string;
  cookies?: Record<string, string>;
};

/** Reads and verifies a signed cookie from a request. */
export function readSignedCookie(
  cookieHeader: string | null,
  name: string,
  options: ReadSignedCookieOptions,
): string | undefined {
  const value = readCookieValue(cookieHeader, name);
  return verifyCookieValue(value, options.secret);
}

/** Parses the request `Cookie` header into `ctx.state.cookies`. */
export function withCookies(stateKey = "cookies"): Middleware {
  return async (ctx, next) => {
    ctx.state[stateKey] = parseCookies(ctx.req.headers.get(HEADER_COOKIE));
    return next();
  };
}

export { sign as signValue, safeEqual as verifySignature };

export type SetCookieAttrs = {
  name: string;
  value: string;
  path: string;
  maxAgeSeconds: number;
  httpOnly: boolean;
  sameSite: "Lax" | "Strict" | "None";
  secure: boolean;
};

export function formatSetCookie(attrs: SetCookieAttrs): string {
  return serializeCookie(attrs.name, attrs.value, {
    path: attrs.path,
    maxAgeSeconds: attrs.maxAgeSeconds,
    httpOnly: attrs.httpOnly,
    sameSite: attrs.sameSite,
    secure: attrs.secure,
  });
}

export function formatClearCookie(attrs: {
  name: string;
  path: string;
  secure: boolean;
}): string {
  return serializeClearedCookie(attrs.name, {
    path: attrs.path,
    sameSite: "Lax",
    secure: attrs.secure,
  });
}
