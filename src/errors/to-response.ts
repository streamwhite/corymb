import {
  ERROR_CODE_INTERNAL,
  isAppError,
} from "@/errors/app-error.js";
import { HEADER_REQUEST_ID } from "@/constants/observability.js";
import { MSG_INTERNAL } from "@/constants/messages.js";
import { HTTP_STATUS_INTERNAL } from "@/constants/http-status.js";

export type ErrorBody = {
  error: string;
  code: string;
  requestId?: string;
  details?: unknown;
};

/** Maps any thrown value to a client-safe status/body, hiding 5xx internals. */
export function toErrorResponse(err: unknown, requestId?: string): Response {
  const isApp = isAppError(err);
  const status = isApp ? err.status : HTTP_STATUS_INTERNAL;
  const message = isApp && err.expose ? err.message : MSG_INTERNAL;
  const code = isApp ? err.code : ERROR_CODE_INTERNAL;
  const body: ErrorBody = { error: message, code };
  if (requestId !== undefined) body.requestId = requestId;
  if (isApp && err.expose && err.details !== undefined) {
    body.details = err.details;
  }
  const headers =
    requestId === undefined ? undefined : { [HEADER_REQUEST_ID]: requestId };
  return Response.json(body, { status, headers });
}
