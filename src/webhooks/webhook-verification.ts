import {
  DEFAULT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  WEBHOOK_SIGNATURE_HEADER,
} from "@/constants/webhook.js";
import { UnauthorizedError, ValidationError } from "@/errors/app-error.js";
import type {
  Middleware,
  MiddlewareContext,
} from "@/middleware/middleware-types.js";
import { verifyWebhookSignature } from "@/webhooks/webhook-signature.js";
import type { WebhookEvent } from "@/webhooks/webhook-types.js";

export const WEBHOOK_BODY_STATE_KEY = "webhookBody" as const;
export const WEBHOOK_EVENT_STATE_KEY = "webhookEvent" as const;

export type WebhookVerificationOptions = {
  secret: string;
  /** Max signature age in seconds (default 300). */
  toleranceSeconds?: number;
  /** Current time in seconds (tests). */
  nowSeconds?: () => number;
  stateKeys?: { body?: string; event?: string };
};

function parseEvent(raw: string): WebhookEvent {
  try {
    return JSON.parse(raw) as WebhookEvent;
  } catch {
    throw new ValidationError("Invalid webhook payload");
  }
}

/** Reads the parsed event attached by `withWebhookVerification`. */
export function readWebhookEvent<T = unknown>(
  ctx: MiddlewareContext,
  key: string = WEBHOOK_EVENT_STATE_KEY,
): WebhookEvent<T> {
  return ctx.state[key] as WebhookEvent<T>;
}

/**
 * Verifies an inbound webhook's HMAC signature against the raw body and
 * attaches the raw body + parsed event to the context. Rejects on mismatch.
 */
export function withWebhookVerification(
  options: WebhookVerificationOptions,
): Middleware {
  const tolerance =
    options.toleranceSeconds ?? DEFAULT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS;
  const bodyKey = options.stateKeys?.body ?? WEBHOOK_BODY_STATE_KEY;
  const eventKey = options.stateKeys?.event ?? WEBHOOK_EVENT_STATE_KEY;
  return async (ctx, next) => {
    const raw = await ctx.req.text();
    const valid = verifyWebhookSignature({
      secret: options.secret,
      body: raw,
      header: ctx.req.headers.get(WEBHOOK_SIGNATURE_HEADER),
      toleranceSeconds: tolerance,
      ...(options.nowSeconds === undefined
        ? {}
        : { nowSeconds: options.nowSeconds() }),
    });
    if (!valid) {
      throw new UnauthorizedError("Invalid webhook signature");
    }
    ctx.state[bodyKey] = raw;
    ctx.state[eventKey] = parseEvent(raw);
    return next();
  };
}
