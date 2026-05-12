/** Max JSON bytes read for auth (and similar) bodies — rejects oversized payloads early. */
export const MAX_JSON_BODY_BYTES = 65_536 as const;

export const HEADER_CONTENT_LENGTH = "Content-Length" as const;

export const HEADER_AUTHORIZATION = "Authorization" as const;

export const HEADER_RETRY_AFTER = "Retry-After" as const;

export const HEADER_X_CONTENT_TYPE_OPTIONS = "X-Content-Type-Options" as const;

export const X_CONTENT_TYPE_OPTIONS_NOSNIFF = "nosniff" as const;

export const HEADER_X_FRAME_OPTIONS = "X-Frame-Options" as const;

export const X_FRAME_OPTIONS_DENY = "DENY" as const;

export const HEADER_REFERRER_POLICY = "Referrer-Policy" as const;

export const REFERRER_POLICY_STRICT_ORIGIN =
  "strict-origin-when-cross-origin" as const;

export const HEADER_PERMISSIONS_POLICY = "Permissions-Policy" as const;

export const PERMISSIONS_POLICY_SENSITIVE_DISABLED =
  "camera=(), microphone=(), geolocation=()" as const;

export const HEADER_CONTENT_SECURITY_POLICY =
  "Content-Security-Policy" as const;

/** Inline styles + inline scripts (auth UI + docs copy helper); no remote assets. */
export const CSP_STATIC_INLINE_UI =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; img-src 'self' data: blob:" as const;

export const HEADER_STRICT_TRANSPORT_SECURITY =
  "Strict-Transport-Security" as const;

export const HSTS_MAX_AGE_INCLUDE_SUBDOMAINS =
  "max-age=15552000; includeSubDomains" as const;
