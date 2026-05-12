import {
  ENV_JWT_SECRET,
  JWT_MIN_SECRET_BYTES,
  JWT_RANDOM_SECRET_BYTES,
} from "@/constants/jwt.js";
import { isNodeEnvProduction } from "@/runtime/node-env.js";

let cachedSecret: Uint8Array | undefined;

function decodeSecret(raw: string): Uint8Array {
  return new TextEncoder().encode(raw);
}

function generateRandomSecret(): Uint8Array {
  const bytes = new Uint8Array(JWT_RANDOM_SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return bytes;
}

function ensureSecretLength(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength < JWT_MIN_SECRET_BYTES) {
    throw new Error(
      `${ENV_JWT_SECRET} must be at least ${String(JWT_MIN_SECRET_BYTES)} bytes`,
    );
  }
  return bytes;
}

function loadSecret(): Uint8Array {
  const raw = process.env[ENV_JWT_SECRET];
  if (raw !== undefined && raw.length > 0) {
    return ensureSecretLength(decodeSecret(raw));
  }
  if (isNodeEnvProduction()) {
    throw new Error(`${ENV_JWT_SECRET} is required in production`);
  }
  return generateRandomSecret();
}

export function getJwtSecret(): Uint8Array {
  if (cachedSecret === undefined) {
    cachedSecret = loadSecret();
  }
  return cachedSecret;
}

/** Test-only: drop cached secret so a fresh one is loaded next call. */
export function resetJwtSecretCacheForTests(): void {
  cachedSecret = undefined;
}
