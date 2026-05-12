import { applySecurityHeadersTo } from "@/http/security-headers.js";

const MIME_JSON_UTF8 = "application/json; charset=utf-8" as const;

export function jsonApiResponse(
  data: unknown,
  init: ResponseInit = {},
  url: URL | null = null,
): Response {
  const headers = new Headers(init.headers);
  applySecurityHeadersTo(headers, "api", url);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", MIME_JSON_UTF8);
  }
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers,
  });
}
