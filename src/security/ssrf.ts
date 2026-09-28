export const SSRF_DEFAULT_ALLOWED_PROTOCOLS = ["https:"] as const;

export type SsrfOptions = {
  /** Allowed protocols (default only `https:`). */
  allowedProtocols?: string[];
  /** Exact/`*.`-wildcard host allowlist; empty means "any non-private host". */
  allowedHosts?: string[];
  /** Allow requests to loopback (default false). */
  allowLoopback?: boolean;
  /** Allow requests to private/link-local ranges (default false). */
  allowPrivate?: boolean;
};

export type SsrfResult =
  | { ok: true; url: URL }
  | { ok: false; reason: SsrfReason };

export const SSRF_REASON_PROTOCOL = "protocol" as const;
export const SSRF_REASON_HOST = "host" as const;
export const SSRF_REASON_PRIVATE = "private-address" as const;
export const SSRF_REASON_INVALID = "invalid-url" as const;

export type SsrfReason =
  | typeof SSRF_REASON_PROTOCOL
  | typeof SSRF_REASON_HOST
  | typeof SSRF_REASON_PRIVATE
  | typeof SSRF_REASON_INVALID;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const PRIVATE_V4_PATTERN =
  /^(10\.|192\.168\.|169\.254\.|0\.)|^172\.(1[6-9]|2\d|3[01])\./;

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost") || host.startsWith("127.")
  );
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host.endsWith(".internal")) return true;
  return PRIVATE_V4_PATTERN.test(host);
}

function hostAllowed(hostname: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const host = hostname.toLowerCase();
  return allowed.some((entry) => {
    const rule = entry.toLowerCase();
    return rule.startsWith("*.")
      ? host.endsWith(rule.slice(1)) || host === rule.slice(2)
      : host === rule;
  });
}

/**
 * Validates an outbound URL against SSRF risks: scheme allowlist and rejection
 * of loopback/private/link-local addresses unless explicitly allowed.
 */
export function checkOutboundUrl(
  raw: string,
  options: SsrfOptions = {},
): SsrfResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: SSRF_REASON_INVALID };
  }
  const protocols = options.allowedProtocols ?? [...SSRF_DEFAULT_ALLOWED_PROTOCOLS];
  if (!protocols.includes(url.protocol)) {
    return { ok: false, reason: SSRF_REASON_PROTOCOL };
  }
  if (!hostAllowed(url.hostname, options.allowedHosts ?? [])) {
    return { ok: false, reason: SSRF_REASON_HOST };
  }
  if (!options.allowLoopback && isLoopbackHostname(url.hostname)) {
    return { ok: false, reason: SSRF_REASON_PRIVATE };
  }
  if (!options.allowPrivate && isPrivateHostname(url.hostname)) {
    return { ok: false, reason: SSRF_REASON_PRIVATE };
  }
  return { ok: true, url };
}

/** Convenience boolean form of `checkOutboundUrl`. */
export function isSafeOutboundUrl(
  raw: string,
  options?: SsrfOptions,
): boolean {
  return checkOutboundUrl(raw, options).ok;
}
