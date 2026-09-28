export type WebhookEndpoint = {
  id: string;
  url: string;
  /** Shared secret used to sign deliveries. */
  secret: string;
  /** Event types this endpoint receives; `["*"]` matches everything. */
  events: string[];
  enabled?: boolean;
  description?: string;
};

export type WebhookEvent<T = unknown> = {
  id: string;
  type: string;
  createdAt: string;
  data: T;
};

export const WEBHOOK_DELIVERY_SUCCESS = "success" as const;
export const WEBHOOK_DELIVERY_FAILED = "failed" as const;
export const WEBHOOK_DELIVERY_SKIPPED = "skipped" as const;

export type WebhookDeliveryStatus =
  | typeof WEBHOOK_DELIVERY_SUCCESS
  | typeof WEBHOOK_DELIVERY_FAILED
  | typeof WEBHOOK_DELIVERY_SKIPPED;

export type WebhookDelivery = {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  url: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus?: number;
  error?: string;
  createdAt: string;
};

export type WebhookEndpointStore = {
  list: () => Promise<WebhookEndpoint[]>;
  get: (id: string) => Promise<WebhookEndpoint | null>;
  add: (endpoint: WebhookEndpoint) => Promise<void>;
  remove: (id: string) => Promise<boolean>;
};

export type WebhookDispatcher = {
  /** Delivers `event` to every matching, enabled endpoint (in parallel). */
  dispatch: (
    event: WebhookEvent,
    options?: { endpointIds?: string[] },
  ) => Promise<WebhookDelivery[]>;
  /** Delivers `event` to one endpoint. */
  send: (
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
  ) => Promise<WebhookDelivery>;
  listEndpoints: () => Promise<WebhookEndpoint[]>;
  registerEndpoint: (endpoint: WebhookEndpoint) => Promise<void>;
  unregisterEndpoint: (id: string) => Promise<boolean>;
  /** Recent deliveries (newest last). */
  deliveries: () => Promise<WebhookDelivery[]>;
};
