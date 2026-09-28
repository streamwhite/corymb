# Feature flags & billing

## Feature flags (`app.flags`)

`FeatureFlags = { isEnabled(name, context?) => Promise<boolean>, all() => Promise<Record<string, boolean>> }`.
`app.flags` is always present; backends are env, static, OpenFeature, or
cache-backed.

```ts
import {
  createEnvFeatureFlags, createStaticFeatureFlags, createOpenFeatureFlags,
  createCachedFeatureFlags, parseFeatureFlags, withFeatureFlag,
} from "corymb";

const app = await createApp();                       // env flags: FEATURE_FLAGS="new-ui,beta"
await app.flags.isEnabled("new-ui");                 // false when unknown
await app.flags.all();

const gated = compose(
  [withFeatureFlag(app.flags, "new-ui")],            // throws NotFoundError (404) when off
  async () => new Response("ok"),
);
```

- `parseFeatureFlags(raw)` accepts JSON (`{"a":true}`) or a comma list
  (`a,b` → both true). Blank/invalid JSON → `{}`.
- `createEnvFeatureFlags(env?)` reads `FEATURE_FLAGS`;
  `createStaticFeatureFlags({...})`; `createOpenFeatureFlags({ provider?, flags?,
  context?, domain?, listFlags? })`.
- `createCachedFeatureFlags({ cache, source?, ttlSeconds?, key? })` caches results
  (key `feature-flags`, default TTL 30s). Used automatically when
  `FEATURE_FLAGS_REMOTE=true`.
- `withFeatureFlag(flags, name, { flagContext? })` gates a route; off → `404`
  (hidden, not `403`). Pass `flagContext(ctx)` to evaluate per-user.
- `createEnvFeatureFlags({ FEATURE_FLAGS: '{"alpha":true}' })` also useful in tests.

Env: `FEATURE_FLAGS`, `FEATURE_FLAGS_REMOTE` (false),
`FEATURE_FLAG_CACHE_TTL_SECONDS` (30). Inject with `createApp({ flags })`.

## Billing & entitlements (`app.billing`)

Provider-agnostic facade: plans/subscriptions/entitlements over any
`BillingProvider` (memory; swap for Stripe/Paddle/Lago). Present unless
`billing: false`.

```ts
import {
  createBilling, createMemoryBillingProvider, withEntitlement,
  BILLING_INTERVAL_MONTH, compose,
} from "corymb";

const app = await createApp({
  billing: createBilling(
    createMemoryBillingProvider({
      plans: [{
        id: "pro", name: "Pro", priceCents: 1900, currency: "USD",
        interval: BILLING_INTERVAL_MONTH, features: ["reports", "api"],
        limits: { seats: 10 },
      }],
    }),
  ),
});

await app.billing!.subscribe("cust-1", "pro");
await app.billing!.hasFeature("cust-1", "reports");   // true
await app.billing!.getLimit("cust-1", "seats");       // 10

const handler = compose(
  [withEntitlement(app.billing!, "reports", { customerId: (ctx) => ctx.auth.user?.id })],
  async () => new Response("ok"),
);
```

- `BillingProvider`: `listPlans`, `getPlan`, `getSubscription`, `subscribe`,
  `changePlan`, `cancel(customerId, { atPeriodEnd? })`, `getEntitlements`.
- `Billing = BillingProvider & { hasFeature(customerId, feature), getLimit(customerId, key) }`.
- `withEntitlement(billing, feature, { customerId })` throws `ForbiddenError`
  (403) when the customer is unresolved or lacks the feature.
- Statuses: `active`, `trialing`, `past_due`, `canceled`; intervals `month`/`year`.

**Gotchas:** the default in-memory provider has no plans, so `subscribe`/
`changePlan` throw until plans are seeded. `getLimit` returns `0` for unknown
customer/key. `cancel(customerId)` clears entitlements immediately; `{ atPeriodEnd:
true }` keeps them until period end. `createBilling` does not cache.
