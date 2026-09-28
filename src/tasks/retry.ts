import { operation, type WrapOptions } from "retry";

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
export class AbortError extends Error {
  override readonly name = "AbortError";
  constructor(message = "Aborted") {
    super(message);
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function buildWrapOptions(options: RetryOperationOptions): WrapOptions {
  return {
    retries: options.retries ?? DEFAULT_RETRIES,
    minTimeout: options.minTimeoutMs ?? DEFAULT_MIN_TIMEOUT_MS,
    maxTimeout: options.maxTimeoutMs ?? DEFAULT_MAX_TIMEOUT_MS,
    factor: options.factor ?? DEFAULT_FACTOR,
    randomize: options.randomize ?? true,
  };
}

function willRetry(
  options: RetryOperationOptions,
  error: unknown,
  attempt: number,
): Promise<boolean> {
  return Promise.resolve(options.shouldRetry?.(error, attempt) ?? true);
}

function notifyFailedAttempt(
  options: RetryOperationOptions,
  error: unknown,
  attempt: number,
  retriesLeft: number,
): Promise<void> {
  return Promise.resolve(
    options.onFailedAttempt?.({ error, attempt, retriesLeft }),
  );
}

/**
 * Retries an async operation with exponential backoff using `retry`. Use this
 * for transient work *inside* a job (network calls, third-party APIs); BullMQ
 * still handles job-level retries (`maxAttempts`/backoff).
 */
export function retryOperation<T>(
  run: (attempt: number) => Promise<T> | T,
  options: RetryOperationOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const op = operation(buildWrapOptions(options));

  return new Promise<T>((resolve, reject) => {
    op.attempt((attempt) => {
      void (async () => {
        try {
          resolve(await run(attempt));
        } catch (error) {
          if (error instanceof AbortError) {
            reject(error);
            return;
          }
          await notifyFailedAttempt(
            options,
            error,
            attempt,
            retries - attempt + 1,
          );
          const retryable = await willRetry(options, error, attempt);
          if (!retryable || !op.retry(toError(error))) {
            reject(error);
          }
        }
      })();
    });
  });
}

/** Stops `retryOperation` from retrying — throw this from the operation. */
export function abortRetry(message?: string): AbortError {
  return new AbortError(message ?? "Aborted");
}
