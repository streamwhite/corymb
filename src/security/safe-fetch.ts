import { MSG_SSRF_BLOCKED, MSG_SSRF_INVALID_URL } from "@/constants/messages.js";
import { ValidationError } from "@/errors/app-error.js";
import {
  SSRF_REASON_HOST,
  SSRF_REASON_INVALID,
  SSRF_REASON_PRIVATE,
  SSRF_REASON_PROTOCOL,
  checkOutboundUrl,
  type SsrfOptions,
  type SsrfReason,
} from "@/security/ssrf.js";

const REASON_MESSAGES: Record<SsrfReason, string> = {
  [SSRF_REASON_INVALID]: MSG_SSRF_INVALID_URL,
  [SSRF_REASON_PROTOCOL]: MSG_SSRF_BLOCKED,
  [SSRF_REASON_HOST]: MSG_SSRF_BLOCKED,
  [SSRF_REASON_PRIVATE]: MSG_SSRF_BLOCKED,
};

/** Validates an outbound URL, throwing a `ValidationError` when unsafe. */
export function assertSafeOutboundUrl(
  raw: string,
  options: SsrfOptions = {},
): URL {
  const result = checkOutboundUrl(raw, options);
  if (!result.ok) {
    throw new ValidationError(REASON_MESSAGES[result.reason]);
  }
  return result.url;
}

/** `fetch` that first rejects unsafe/private outbound URLs (SSRF defense). */
export async function safeFetch(
  raw: string,
  init?: RequestInit,
  options: SsrfOptions = {},
): Promise<Response> {
  return fetch(assertSafeOutboundUrl(raw, options), init);
}
