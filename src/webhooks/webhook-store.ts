import type {
  WebhookEndpoint,
  WebhookEndpointStore,
} from "@/webhooks/webhook-types.js";

/** In-memory endpoint store (tests, single instance, reference impl). */
export function createMemoryWebhookEndpointStore(
  endpoints: WebhookEndpoint[] = [],
): WebhookEndpointStore {
  const entries = new Map<string, WebhookEndpoint>();
  for (const endpoint of endpoints) {
    entries.set(endpoint.id, endpoint);
  }
  return {
    async list() {
      return [...entries.values()];
    },
    async get(id) {
      return entries.get(id) ?? null;
    },
    async add(endpoint) {
      entries.set(endpoint.id, endpoint);
    },
    async remove(id) {
      return entries.delete(id);
    },
  };
}
