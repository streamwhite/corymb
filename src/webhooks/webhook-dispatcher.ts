import {
  DEFAULT_WEBHOOK_MAX_DELIVERY_LOG,
  DEFAULT_WEBHOOK_MAX_TIMEOUT_MS,
  DEFAULT_WEBHOOK_MIN_TIMEOUT_MS,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  WEBHOOK_WILDCARD_EVENT,
  resolveWebhookConfigFromEnv,
  type WebhookConfig,
} from "@/constants/webhook.js";
import { checkOutboundUrl } from "@/security/ssrf.js";
import { abortRetry, retryOperation } from "@/tasks/retry.js";
import { buildWebhookSignatureHeader } from "@/webhooks/webhook-signature.js";
import { createMemoryWebhookEndpointStore } from "@/webhooks/webhook-store.js";
import {
  WEBHOOK_DELIVERY_FAILED,
  WEBHOOK_DELIVERY_SKIPPED,
  WEBHOOK_DELIVERY_SUCCESS,
  type WebhookDelivery,
  type WebhookDispatcher,
  type WebhookEndpoint,
  type WebhookEndpointStore,
  type WebhookEvent,
} from "@/webhooks/webhook-types.js";
import type { Logger } from "@/observability/logger.js";

const CONTENT_TYPE_HEADER = "content-type" as const;
const JSON_CONTENT_TYPE = "application/json" as const;
const DEFAULT_FACTOR = 2 as const;
const RETRYABLE_STATUSES = new Set([408, 425, 429]);
const SERVER_ERROR_MIN = 500;
const MS_PER_SECOND = 1000 as const;

export type WebhookDispatcherOptions = Partial<WebhookConfig> & {
  endpoints?: WebhookEndpoint[];
  store?: WebhookEndpointStore;
  /** Injectable fetch (tests). Defaults to global `fetch`. */
  fetch?: typeof fetch;
  minTimeoutMs?: number;
  maxTimeoutMs?: number;
  factor?: number;
  /** Allow loopback/private webhook targets (default false). */
  allowPrivateHosts?: boolean;
  logger?: Logger;
  /** Observability hook invoked after every delivery attempt outcome. */
  onDelivery?: (delivery: WebhookDelivery) => void;
  maxDeliveryLog?: number;
  idFactory?: () => string;
  now?: () => Date;
};

/** Builds an event envelope with a unique id and timestamp. */
export function createWebhookEvent<T>(
  type: string,
  data: T,
  options: { id?: string; createdAt?: string } = {},
): WebhookEvent<T> {
  return {
    id: options.id ?? crypto.randomUUID(),
    type,
    createdAt: options.createdAt ?? new Date().toISOString(),
    data,
  };
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status) || status >= SERVER_ERROR_MIN;
}

function matchesEvent(endpoint: WebhookEndpoint, event: WebhookEvent): boolean {
  return (
    endpoint.events.includes(WEBHOOK_WILDCARD_EVENT) ||
    endpoint.events.includes(event.type)
  );
}

function buildHeaders(
  endpoint: WebhookEndpoint,
  event: WebhookEvent,
  body: string,
  timestampSeconds: number,
): Record<string, string> {
  return {
    [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
    [WEBHOOK_ID_HEADER]: event.id,
    [WEBHOOK_EVENT_HEADER]: event.type,
    [WEBHOOK_TIMESTAMP_HEADER]: String(timestampSeconds),
    [WEBHOOK_SIGNATURE_HEADER]: buildWebhookSignatureHeader(
      endpoint.secret,
      body,
      timestampSeconds,
    ),
  };
}

export function createWebhookDispatcher(
  options: WebhookDispatcherOptions = {},
): WebhookDispatcher {
  const config = resolveWebhookConfigFromEnv();
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const retries = options.retries ?? config.retries;
  const minTimeoutMs = options.minTimeoutMs ?? DEFAULT_WEBHOOK_MIN_TIMEOUT_MS;
  const maxTimeoutMs = options.maxTimeoutMs ?? DEFAULT_WEBHOOK_MAX_TIMEOUT_MS;
  const factor = options.factor ?? DEFAULT_FACTOR;
  const allowInsecureHttp = options.allowInsecureHttp ?? config.allowInsecureHttp;
  const maxDeliveryLog =
    options.maxDeliveryLog ?? DEFAULT_WEBHOOK_MAX_DELIVERY_LOG;
  const fetchImpl = options.fetch ?? fetch;
  const store =
    options.store ?? createMemoryWebhookEndpointStore(options.endpoints ?? []);
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const log: WebhookDelivery[] = [];

  const record = (delivery: WebhookDelivery): WebhookDelivery => {
    log.push(delivery);
    if (log.length > maxDeliveryLog) {
      log.splice(0, log.length - maxDeliveryLog);
    }
    options.onDelivery?.(delivery);
    if (delivery.status === WEBHOOK_DELIVERY_FAILED) {
      options.logger?.warn("webhook delivery failed", {
        endpointId: delivery.endpointId,
        eventType: delivery.eventType,
        responseStatus: delivery.responseStatus,
        error: delivery.error,
      });
    }
    return delivery;
  };

  const send = async (
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
  ): Promise<WebhookDelivery> => {
    const base = {
      id: idFactory(),
      endpointId: endpoint.id,
      eventId: event.id,
      eventType: event.type,
      url: endpoint.url,
      createdAt: now().toISOString(),
    };
    const target = checkOutboundUrl(endpoint.url, {
      ...(allowInsecureHttp
        ? { allowedProtocols: ["https:", "http:"] }
        : {}),
      allowPrivate: options.allowPrivateHosts ?? false,
    });
    if (!target.ok) {
      return record({
        ...base,
        status: WEBHOOK_DELIVERY_SKIPPED,
        attempts: 0,
        error: `blocked:${target.reason}`,
      });
    }
    const body = JSON.stringify(event);
    let attempts = 0;
    let responseStatus: number | undefined;
    try {
      await retryOperation(
        async (attempt) => {
          attempts = attempt;
          const timestampSeconds = Math.floor(now().getTime() / MS_PER_SECOND);
          const response = await fetchImpl(target.url, {
            method: "POST",
            headers: buildHeaders(endpoint, event, body, timestampSeconds),
            body,
            signal: AbortSignal.timeout(timeoutMs),
          });
          responseStatus = response.status;
          if (response.ok) {
            return;
          }
          const message = `Webhook responded ${String(response.status)}`;
          if (isRetryableStatus(response.status)) {
            throw new Error(message);
          }
          throw abortRetry(message);
        },
        {
          retries,
          minTimeoutMs,
          maxTimeoutMs,
          factor,
          randomize: true,
          onFailedAttempt: ({ error, attempt }) => {
            options.logger?.debug("webhook attempt failed", {
              endpointId: endpoint.id,
              attempt,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        },
      );
      return record({
        ...base,
        status: WEBHOOK_DELIVERY_SUCCESS,
        attempts,
        responseStatus,
      });
    } catch (error) {
      return record({
        ...base,
        status: WEBHOOK_DELIVERY_FAILED,
        attempts: attempts === 0 ? 1 : attempts,
        responseStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    async dispatch(event, dispatchOptions) {
      const endpoints = await store.list();
      const ids = dispatchOptions?.endpointIds;
      const targets = endpoints.filter(
        (endpoint) =>
          endpoint.enabled !== false &&
          matchesEvent(endpoint, event) &&
          (ids === undefined || ids.includes(endpoint.id)),
      );
      return Promise.all(targets.map((endpoint) => send(endpoint, event)));
    },
    send,
    listEndpoints: () => store.list(),
    registerEndpoint: (endpoint) => store.add(endpoint),
    unregisterEndpoint: (id) => store.remove(id),
    async deliveries() {
      return [...log];
    },
  };
}
