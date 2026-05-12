import {
  CSP_STATIC_INLINE_UI,
  HEADER_CONTENT_SECURITY_POLICY,
  HEADER_PERMISSIONS_POLICY,
  HEADER_REFERRER_POLICY,
  HEADER_STRICT_TRANSPORT_SECURITY,
  HEADER_X_CONTENT_TYPE_OPTIONS,
  HEADER_X_FRAME_OPTIONS,
  HSTS_MAX_AGE_INCLUDE_SUBDOMAINS,
  PERMISSIONS_POLICY_SENSITIVE_DISABLED,
  REFERRER_POLICY_STRICT_ORIGIN,
  X_CONTENT_TYPE_OPTIONS_NOSNIFF,
  X_FRAME_OPTIONS_DENY,
} from "@/constants/http-security.js";

export type SecurityHeaderKind = "api" | "html";

function applyHttpsOnlyHeaders(headers: Headers, url: URL): void {
  if (url.protocol !== "https:") {
    return;
  }
  headers.set(
    HEADER_STRICT_TRANSPORT_SECURITY,
    HSTS_MAX_AGE_INCLUDE_SUBDOMAINS,
  );
}

function applyCommonSecurityHeaders(headers: Headers): void {
  headers.set(HEADER_X_CONTENT_TYPE_OPTIONS, X_CONTENT_TYPE_OPTIONS_NOSNIFF);
  headers.set(HEADER_X_FRAME_OPTIONS, X_FRAME_OPTIONS_DENY);
  headers.set(HEADER_REFERRER_POLICY, REFERRER_POLICY_STRICT_ORIGIN);
  headers.set(HEADER_PERMISSIONS_POLICY, PERMISSIONS_POLICY_SENSITIVE_DISABLED);
}

export function applySecurityHeadersTo(
  headers: Headers,
  kind: SecurityHeaderKind,
  url: URL | null,
): void {
  applyCommonSecurityHeaders(headers);
  if (kind === "html") {
    headers.set(HEADER_CONTENT_SECURITY_POLICY, CSP_STATIC_INLINE_UI);
  }
  if (url !== null) {
    applyHttpsOnlyHeaders(headers, url);
  }
}

export function withSecurityHeaders(
  res: Response,
  kind: SecurityHeaderKind,
  url: URL | null,
): Response {
  const headers = new Headers(res.headers);
  applySecurityHeadersTo(headers, kind, url);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function withSecurityHeadersFromRequest(
  res: Response,
  req: Request,
  kind: SecurityHeaderKind,
): Response {
  return withSecurityHeaders(res, kind, new URL(req.url));
}
