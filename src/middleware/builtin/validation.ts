import { ValidationError } from "@/errors/app-error.js";
import { readJsonUnknown } from "@/http/json-body.js";
import type { Middleware } from "@/middleware/middleware-types.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import { sanitizeStrings } from "@/security/sanitize.js";

/** A validator parses/normalizes raw input or throws to reject it. */
export type Validator<T> = (input: unknown) => T;

export type ValidationTarget = "json" | "query";

export type ValidationOptions = {
  target?: ValidationTarget;
  stateKey?: string;
  /** Strip HTML tags/control chars from string fields before validating. */
  sanitize?: boolean;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ValidationError };

/** Runs a validator, converting thrown errors into a `ValidationError`. */
export function validate<T>(validator: Validator<T>, input: unknown): ValidationResult<T> {
  try {
    return { ok: true, value: validator(input) };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, error: err };
    }
    const message = err instanceof Error ? err.message : "Invalid input";
    return { ok: false, error: new ValidationError(message) };
  }
}

function queryToObject(url: URL): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams) {
    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }
  return out;
}

async function readInput(ctx: MiddlewareContext, target: ValidationTarget): Promise<unknown> {
  if (target === "query") {
    return queryToObject(ctx.url);
  }
  const parsed = await readJsonUnknown(ctx.req);
  if (!parsed.ok) {
    throw new ValidationError(parsed.error);
  }
  return parsed.value;
}

/**
 * Validates the request body (JSON) or query into `ctx.state[stateKey]`.
 * Throws `ValidationError` on failure so the error middleware renders a 400.
 */
export function withValidation<T>(
  validator: Validator<T>,
  options: ValidationOptions = {},
): Middleware {
  const target = options.target ?? "json";
  const stateKey = options.stateKey ?? "input";
  return async (ctx, next) => {
    const raw = await readInput(ctx, target);
    const input = options.sanitize === true ? sanitizeStrings(raw) : raw;
    const result = validate(validator, input);
    if (!result.ok) {
      throw result.error;
    }
    ctx.state[stateKey] = result.value;
    return next();
  };
}

/** Reads a validated value attached by `withValidation`. */
export function readValidated<T>(ctx: MiddlewareContext, stateKey = "input"): T {
  return ctx.state[stateKey] as T;
}

export { queryToObject };
