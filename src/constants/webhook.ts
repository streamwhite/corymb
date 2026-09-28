import { readBoolEnv, readEnv } from "@/config/env.js";
import { parsePositiveIntEnv } from "@/constants/env-int.js";

export const WEBHOOK_SIGNATURE_HEADER = "X-Webhook-Signature" as const;

export const WEBHOOK_TIMESTAMP_HEADER = "X-Webhook-Timestamp" as const;

export const WEBHOOK_EVENT_HEADER = "X-Webhook-Event" as const;

export const WEBHOOK_ID_HEADER = "X-Webhook-Id" as const;

/** Signature scheme tag inside the `X-Webhook-Signature` header. */
export const WEBHOOK_SIGNATURE_VERSION = "v1" as const;

/** Matches every event type when listed in an endpoint's `events`. */
export const WEBHOOK_WILDCARD_EVENT = "*" as const;

export const DEFAULT_WEBHOOK_TIMEOUT_MS = 10_000 as const;

export const DEFAULT_WEBHOOK_RETRIES = 3 as const;

export const DEFAULT_WEBHOOK_MIN_TIMEOUT_MS = 500 as const;

export const DEFAULT_WEBHOOK_MAX_TIMEOUT_MS = 30_000 as const;

/** Max age of an inbound signature timestamp before it is rejected (seconds). */
export const DEFAULT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300 as const;

export const DEFAULT_WEBHOOK_MAX_DELIVERY_LOG = 1000 as const;

export const ENV_WEBHOOK_TIMEOUT_MS = "WEBHOOK_TIMEOUT_MS" as const;

export const ENV_WEBHOOK_RETRIES = "WEBHOOK_RETRIES" as const;

export const ENV_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS =
  "WEBHOOK_SIGNATURE_TOLERANCE_SECONDS" as const;

export const ENV_WEBHOOK_ALLOW_INSECURE_HTTP =
  "WEBHOOK_ALLOW_INSECURE_HTTP" as const;

export type WebhookConfig = {
  timeoutMs: number;
  retries: number;
  signatureToleranceSeconds: number;
  allowInsecureHttp: boolean;
};

/** Resolves outbound webhook delivery settings from env. */
export function resolveWebhookConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): WebhookConfig {
  return {
    timeoutMs: parsePositiveIntEnv(
      readEnv(ENV_WEBHOOK_TIMEOUT_MS, env),
      DEFAULT_WEBHOOK_TIMEOUT_MS,
    ),
    retries: parsePositiveIntEnv(
      readEnv(ENV_WEBHOOK_RETRIES, env),
      DEFAULT_WEBHOOK_RETRIES,
    ),
    signatureToleranceSeconds: parsePositiveIntEnv(
      readEnv(ENV_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS, env),
      DEFAULT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
    ),
    allowInsecureHttp: readBoolEnv(
      ENV_WEBHOOK_ALLOW_INSECURE_HTTP,
      false,
      env,
    ),
  };
}
