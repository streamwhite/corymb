export const ERROR_CODE_INTERNAL = "internal_error" as const;
export const ERROR_CODE_VALIDATION = "validation_error" as const;
export const ERROR_CODE_UNAUTHORIZED = "unauthorized" as const;
export const ERROR_CODE_FORBIDDEN = "forbidden" as const;
export const ERROR_CODE_NOT_FOUND = "not_found" as const;
export const ERROR_CODE_CONFLICT = "conflict" as const;
export const ERROR_CODE_RATE_LIMITED = "rate_limited" as const;
export const ERROR_CODE_SERVICE_UNAVAILABLE = "service_unavailable" as const;

export type AppErrorOptions = {
  code?: string;
  /** Safe to expose to clients. Defaults to true for 4xx, false for 5xx. */
  expose?: boolean;
  cause?: unknown;
  details?: unknown;
};

/**
 * Base class for operational errors. `status` drives the HTTP response and
 * `expose` controls whether the message is sent to the client (5xx messages
 * are hidden by default).
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean;
  readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.status = status;
    this.code =
      options.code ??
      (status >= 500 ? ERROR_CODE_INTERNAL : ERROR_CODE_VALIDATION);
    this.expose = options.expose ?? status < 500;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request", details?: unknown) {
    super(400, message, { code: ERROR_CODE_VALIDATION, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(401, message, { code: ERROR_CODE_UNAUTHORIZED, details });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown) {
    super(403, message, { code: ERROR_CODE_FORBIDDEN, details });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", details?: unknown) {
    super(404, message, { code: ERROR_CODE_NOT_FOUND, details });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(409, message, { code: ERROR_CODE_CONFLICT, details });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests", details?: unknown) {
    super(429, message, { code: ERROR_CODE_RATE_LIMITED, details });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service unavailable", details?: unknown) {
    super(503, message, { code: ERROR_CODE_SERVICE_UNAVAILABLE, details });
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
