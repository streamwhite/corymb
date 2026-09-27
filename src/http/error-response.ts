import { HEADER_REQUEST_ID } from "@/constants/observability.js";

export type ErrorResponseOptions = {
  requestId?: string;
  headers?: HeadersInit;
};

/** Unified JSON error body: `{ error, requestId? }`. */
export function errorResponse(
  status: number,
  message: string,
  options?: ErrorResponseOptions,
): Response {
  const body: Record<string, string> = { error: message };
  const headers = new Headers(options?.headers);
  if (options?.requestId !== undefined) {
    body.requestId = options.requestId;
    headers.set(HEADER_REQUEST_ID, options.requestId);
  }
  return Response.json(body, { status, headers });
}
