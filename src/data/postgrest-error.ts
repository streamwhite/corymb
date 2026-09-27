export type PostgrestErrorPayload = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

/** Error raised for a non-2xx PostgREST response, with the parsed error body. */
export class PostgrestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(status: number, payload: PostgrestErrorPayload) {
    super(payload.message ?? `PostgREST request failed (${String(status)})`);
    this.name = "PostgrestError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
    this.hint = payload.hint;
  }
}

export async function toPostgrestError(
  response: Response,
): Promise<PostgrestError> {
  const payload = (await response
    .json()
    .catch(() => ({}))) as PostgrestErrorPayload;
  return new PostgrestError(response.status, payload);
}
