import { getJwtSecret } from "@/auth/jwt-secret.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_ALG_HS256,
  JWT_HEADER_PART_SEPARATOR,
  JWT_ISSUER,
  JWT_TYP,
} from "@/constants/jwt.js";

export type AccessTokenClaims = {
  sub: string;
  iss: string;
  iat: number;
  exp: number;
};

const HMAC_ALGORITHM = { name: "HMAC", hash: "SHA-256" } as const;

const SECONDS_PER_MS = 1000 as const;

const JWT_PARTS_COUNT = 3 as const;

const JWT_HEADER_INDEX = 0 as const;

const JWT_PAYLOAD_INDEX = 1 as const;

const JWT_SIGNATURE_INDEX = 2 as const;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlDecodeBytes(input: string): Uint8Array {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLen));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function base64UrlDecodeText(input: string): string {
  return new TextDecoder().decode(base64UrlDecodeBytes(input));
}

async function importHmacKey(secret: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    secret as unknown as ArrayBuffer,
    HMAC_ALGORITHM,
    false,
    ["sign", "verify"],
  );
}

function nowSeconds(): number {
  return Math.floor(Date.now() / SECONDS_PER_MS);
}

async function signSignatureBytes(
  signingInput: string,
  secret: Uint8Array,
): Promise<Uint8Array> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    HMAC_ALGORITHM,
    key,
    new TextEncoder().encode(signingInput),
  );
  return new Uint8Array(sig);
}

export async function signAccessToken(userId: string): Promise<string> {
  const secret = getJwtSecret();
  const header = { alg: JWT_ALG_HS256, typ: JWT_TYP };
  const iat = nowSeconds();
  const claims: AccessTokenClaims = {
    sub: userId,
    iss: JWT_ISSUER,
    iat,
    exp: iat + ACCESS_TOKEN_TTL_SECONDS,
  };
  const signingInput = `${base64UrlEncodeJson(header)}${JWT_HEADER_PART_SEPARATOR}${base64UrlEncodeJson(claims)}`;
  const signature = await signSignatureBytes(signingInput, secret);
  return `${signingInput}${JWT_HEADER_PART_SEPARATOR}${base64UrlEncode(signature)}`;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

function splitJwt(
  token: string,
): { header: string; payload: string; signature: string } | null {
  const parts = token.split(JWT_HEADER_PART_SEPARATOR);
  if (parts.length !== JWT_PARTS_COUNT) {
    return null;
  }
  return {
    header: parts[JWT_HEADER_INDEX] ?? "",
    payload: parts[JWT_PAYLOAD_INDEX] ?? "",
    signature: parts[JWT_SIGNATURE_INDEX] ?? "",
  };
}

function parseHeader(rawHeader: string): { alg?: string; typ?: string } | null {
  try {
    const parsed = JSON.parse(base64UrlDecodeText(rawHeader)) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as { alg?: string; typ?: string };
    }
    return null;
  } catch {
    return null;
  }
}

function parseClaims(rawPayload: string): AccessTokenClaims | null {
  try {
    const parsed = JSON.parse(base64UrlDecodeText(rawPayload)) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const obj = parsed as Partial<AccessTokenClaims>;
    if (
      typeof obj.sub !== "string" ||
      typeof obj.iss !== "string" ||
      typeof obj.iat !== "number" ||
      typeof obj.exp !== "number"
    ) {
      return null;
    }
    return { sub: obj.sub, iss: obj.iss, iat: obj.iat, exp: obj.exp };
  } catch {
    return null;
  }
}

export type AccessTokenVerification =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false };

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenVerification> {
  const parts = splitJwt(token);
  if (parts === null) {
    return { ok: false };
  }
  const header = parseHeader(parts.header);
  if (
    header === null ||
    header.alg !== JWT_ALG_HS256 ||
    header.typ !== JWT_TYP
  ) {
    return { ok: false };
  }
  const claims = parseClaims(parts.payload);
  if (claims === null || claims.iss !== JWT_ISSUER) {
    return { ok: false };
  }
  if (claims.exp <= nowSeconds()) {
    return { ok: false };
  }
  const secret = getJwtSecret();
  const signingInput = `${parts.header}${JWT_HEADER_PART_SEPARATOR}${parts.payload}`;
  const expected = await signSignatureBytes(signingInput, secret);
  let provided: Uint8Array;
  try {
    provided = base64UrlDecodeBytes(parts.signature);
  } catch {
    return { ok: false };
  }
  if (!timingSafeEqualBytes(expected, provided)) {
    return { ok: false };
  }
  return { ok: true, claims };
}
