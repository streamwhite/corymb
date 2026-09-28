import { createHmac, timingSafeEqual } from "node:crypto";
import { WEBHOOK_SIGNATURE_VERSION } from "@/constants/webhook.js";

const SIGNATURE_SEPARATOR = "," as const;
const PART_SEPARATOR = "=" as const;
const TIMESTAMP_KEY = "t" as const;

/** HMAC-SHA256 over `${timestamp}.${body}`, hex encoded. */
export function signWebhookPayload(
  secret: string,
  body: string,
  timestampSeconds: number,
): string {
  return createHmac("sha256", secret)
    .update(`${timestampSeconds}.${body}`)
    .digest("hex");
}

/** Builds the `t=<ts>,v1=<hmac>` signature header value. */
export function buildWebhookSignatureHeader(
  secret: string,
  body: string,
  timestampSeconds: number,
): string {
  const signature = signWebhookPayload(secret, body, timestampSeconds);
  return `${TIMESTAMP_KEY}${PART_SEPARATOR}${timestampSeconds}${SIGNATURE_SEPARATOR}${WEBHOOK_SIGNATURE_VERSION}${PART_SEPARATOR}${signature}`;
}

export type ParsedWebhookSignature = {
  timestamp: number;
  signatures: string[];
};

/** Parses a signature header, returning null when malformed. */
export function parseWebhookSignatureHeader(
  header: string | null,
): ParsedWebhookSignature | null {
  if (header === null || header.length === 0) {
    return null;
  }
  let timestamp = Number.NaN;
  const signatures: string[] = [];
  for (const part of header.split(SIGNATURE_SEPARATOR)) {
    const index = part.indexOf(PART_SEPARATOR);
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === TIMESTAMP_KEY) {
      timestamp = Number.parseInt(value, 10);
    } else if (key === WEBHOOK_SIGNATURE_VERSION) {
      signatures.push(value);
    }
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    return null;
  }
  return { timestamp, signatures };
}

function hexEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export type VerifyWebhookSignatureOptions = {
  secret: string;
  /** Raw request body exactly as received. */
  body: string;
  header: string | null;
  /** Max clock skew in seconds; `0` disables the freshness check. */
  toleranceSeconds?: number;
  /** Current time in seconds (tests). */
  nowSeconds?: number;
};

/** Constant-time verification of an inbound webhook signature. */
export function verifyWebhookSignature(
  options: VerifyWebhookSignatureOptions,
): boolean {
  const parsed = parseWebhookSignatureHeader(options.header);
  if (parsed === null) {
    return false;
  }
  const tolerance = options.toleranceSeconds ?? 0;
  if (tolerance > 0) {
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - parsed.timestamp) > tolerance) {
      return false;
    }
  }
  const expected = signWebhookPayload(
    options.secret,
    options.body,
    parsed.timestamp,
  );
  return parsed.signatures.some((signature) => hexEqual(signature, expected));
}
