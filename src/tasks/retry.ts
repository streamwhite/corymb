import pRetry, { AbortError, type Options as PRetryOptions } from "p-retry";

export type RetryOperationOptions = {
  /** Maximum number of retries after the first attempt (default 3). */
  retries?: number;
  /** Base delay between attempts in ms (default 200). */
  minTimeoutMs?: number;
  /** Maximum delay between attempts in ms (default 5000). */
  maxTimeoutMs?: number;
  /** Exponential backoff factor (default 2). */
  factor?: number;
  /** Randomize delays to avoid thundering herds (default true). */
  randomize?: boolean;
  /** Decide whether an error should be retried (default: all but AbortError). */
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;
  /** Called after each failed attempt (before the next retry). */
  onFailedAttempt?: (info: {
    error: unknown;
    attempt: number;
    retriesLeft: number;
  }) => void | Promise<void>;
};

const DEFAULT_RETRIES = 3;
const DEFAULT_MIN_TIMEOUT_MS = 200;
const DEFAULT_MAX_TIMEOUT_MS = 5000;
const DEFAULT_FACTOR = 2;

/** Thrown to stop retrying immediately (e.g. on non-retryable errors). */
export { AbortError };

/**
 * Retries an async operation with exponential backoff using `p-retry`. Use this
 * for transient work *inside* a job (network calls, third-party APIs); BullMQ
 * still handles job-level retries (`maxAttempts`/backoff).
 */
export async function retryOperation<T>(
  operation: (attempt: number) => Promise<T> | T,
  options: RetryOperationOptions = {},
): Promise<T> {
  const pr: PRetryOptions = {
    retries: options.retries ?? DEFAULT_RETRIES,
    minTimeout: options.minTimeoutMs ?? DEFAULT_MIN_TIMEOUT_MS,
    maxTimeout: options.maxTimeoutMs ?? DEFAULT_MAX_TIMEOUT_MS,
    factor: options.factor ?? DEFAULT_FACTOR,
    randomize: options.randomize ?? true,
    ...(options.onFailedAttempt === undefined
      ? {}
      : {
          onFailedAttempt: (ctx) =>
            options.onFailedAttempt?.({
              error: ctx.error,
              attempt: ctx.attemptNumber,
              retriesLeft: ctx.retriesLeft,
            }),
        }),
    ...(options.shouldRetry === undefined
      ? {}
      : {
          shouldRetry: (ctx: { error: unknown; attemptNumber: number }) =>
            options.shouldRetry?.(ctx.error, ctx.attemptNumber) ?? true,
        }),
  };
  return pRetry((attempt: number) => operation(attempt), pr);
}

/** Stops `retryOperation` from retrying — throw this from the operation. */
export function abortRetry(message?: string): AbortError {
  return new AbortError(message ?? "Aborted");
}
