import { HEADER_REQUEST_ID } from "@/constants/observability.js";

/** Reuses an inbound request id when present, otherwise generates one. */
export function resolveRequestId(req: Request): string {
  const incoming = req.headers.get(HEADER_REQUEST_ID)?.trim();
  return incoming !== undefined && incoming.length > 0
    ? incoming
    : crypto.randomUUID();
}
