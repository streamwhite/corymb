# Webhooks

Outbound signed event delivery to registered endpoints, plus constant-time
verification of inbound webhook signatures. Same HMAC scheme on both sides:
sign the string `` `${timestampSeconds}.${body}` `` with HMAC-SHA256.

## Outbound (`app.webhooks`)

```ts
import { createWebhookDispatcher, createWebhookEvent } from "bun-backend-starter";

const webhooks = createWebhookDispatcher({
  endpoints: [{ id: "ep_1", url: "https://example.com/hooks", secret: process.env.WH_SECRET!, events: ["user.created"] }],
  retries: 3,
  allowPrivateHosts: false,
});

await webhooks.dispatch(createWebhookEvent("user.created", { id: "u1" }));
```

Configure via `createApp({ webhooks: dispatcherOrOptions })` (resolved to
`app.webhooks`); pass `false`/omit to disable.

`WebhookDispatcher`:

| Member | Purpose |
| --- | --- |
| `dispatch(event, { endpointIds? })` | Deliver to matching endpoints; returns `WebhookDelivery[]`. |
| `send(endpoint, event)` | Deliver to one endpoint. |
| `registerEndpoint` / `unregisterEndpoint` / `listEndpoints` | Manage endpoints. |
| `deliveries()` | In-memory delivery log (capped, default 1000). |

`WebhookEndpoint = { id, url, secret, events: string[], enabled?, description? }`
(`events: ["*"]` matches all). `WebhookEvent<T> = { id, type, createdAt, data }`.
Deliveries run in parallel and resolve to
`success` | `failed` | `skipped` rather than rejecting. Retries only for `408`,
`425`, `429`, or `>= 500`; jittered exponential backoff.

Outbound headers: `content-type: application/json`, `X-Webhook-Id`,
`X-Webhook-Event`, `X-Webhook-Timestamp`, `X-Webhook-Signature:
t=<ts>,v1=<hex hmac>`. Targets are SSRF-checked (https only, private/loopback
blocked → `skipped` with `error: "blocked:<reason>"`); relax with
`allowInsecureHttp` / `allowPrivateHosts`.

## Inbound verification

```ts
import { compose, readWebhookEvent, withWebhookVerification } from "bun-backend-starter";

const handler = compose(
  [withWebhookVerification({ secret: process.env.WH_SECRET!, toleranceSeconds: 300 })],
  async (ctx) => Response.json(readWebhookEvent(ctx)),
);
```

`withWebhookVerification({ secret, toleranceSeconds?, nowSeconds?, stateKeys? })`
reads `X-Webhook-Signature`, verifies against the raw body, and attaches the
event. Failure → `401 UnauthorizedError` (`"Invalid webhook signature"`, bad
signature/stale) or `400 ValidationError` (non-JSON body).

Manual helpers: `signWebhookPayload`, `buildWebhookSignatureHeader`,
`parseWebhookSignatureHeader`, `verifyWebhookSignature({ secret, body, header,
toleranceSeconds?, nowSeconds? })` (timing-safe; accepts any matching `v1`).

## Gotchas

- `withWebhookVerification` consumes the body; downstream handlers must use
  `readWebhookEvent(ctx)` / `ctx.state.webhookBody`, not re-read the request.
- Replay protection is timestamp freshness only — no nonce/jti dedup.
- `verifyWebhookSignature` defaults `toleranceSeconds` to `0` (disabled);
  the middleware defaults to 300. Pass it explicitly to use env config.
- `createMemoryWebhookEndpointStore(endpoints?)` is available; swap for a durable
  `WebhookEndpointStore` (`list`/`get`/`add`/`remove`).

Env: `WEBHOOK_TIMEOUT_MS` (10000), `WEBHOOK_RETRIES` (3),
`WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` (300), `WEBHOOK_ALLOW_INSECURE_HTTP` (false).
Headers: `WEBHOOK_ID_HEADER`, `WEBHOOK_EVENT_HEADER`, `WEBHOOK_TIMESTAMP_HEADER`,
`WEBHOOK_SIGNATURE_HEADER`, `WEBHOOK_WILDCARD_EVENT` (`*`).
