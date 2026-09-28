import { describe, expect, it } from "bun:test";
import {
  createBilling,
  createMemoryBillingProvider,
} from "@/billing/billing.js";
import {
  BILLING_INTERVAL_MONTH,
  SUBSCRIPTION_STATUS_ACTIVE,
  SUBSCRIPTION_STATUS_CANCELED,
  type Plan,
} from "@/billing/billing-types.js";
import { withEntitlement } from "@/billing/entitlement-middleware.js";
import { ForbiddenError } from "@/errors/app-error.js";
import { compose } from "@/middleware/compose.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import { createLogger } from "@/observability/logger.js";

const free: Plan = {
  id: "free",
  name: "Free",
  priceCents: 0,
  currency: "USD",
  interval: BILLING_INTERVAL_MONTH,
  features: [],
  limits: { seats: 1 },
};

const pro: Plan = {
  id: "pro",
  name: "Pro",
  priceCents: 1900,
  currency: "USD",
  interval: BILLING_INTERVAL_MONTH,
  features: ["reports", "api"],
  limits: { seats: 10 },
};

function memoryBilling() {
  return createBilling(createMemoryBillingProvider({ plans: [free, pro] }));
}

function ctxFor(): MiddlewareContext {
  const req = new Request("http://x.test/");
  return {
    req,
    url: new URL(req.url),
    requestId: "r1",
    logger: createLogger({}, { level: "error", writer: () => {} }),
    cache: {} as MiddlewareContext["cache"],
    auth: {} as MiddlewareContext["auth"],
    storage: {} as MiddlewareContext["storage"],
    state: {},
  };
}

describe("memory billing provider", () => {
  it("subscribes a customer to a plan and exposes entitlements", async () => {
    const billing = memoryBilling();
    const sub = await billing.subscribe("cust-1", "pro");
    expect(sub.status).toBe(SUBSCRIPTION_STATUS_ACTIVE);
    expect(await billing.hasFeature("cust-1", "reports")).toBe(true);
    expect(await billing.getLimit("cust-1", "seats")).toBe(10);
  });

  it("changes plans and updates entitlements", async () => {
    const billing = memoryBilling();
    await billing.subscribe("cust-2", "free");
    expect(await billing.hasFeature("cust-2", "reports")).toBe(false);
    await billing.changePlan("cust-2", "pro");
    expect(await billing.hasFeature("cust-2", "reports")).toBe(true);
  });

  it("cancels at period end without dropping entitlements", async () => {
    const billing = memoryBilling();
    await billing.subscribe("cust-3", "pro");
    const canceled = await billing.cancel("cust-3", { atPeriodEnd: true });
    expect(canceled?.cancelAtPeriodEnd).toBe(true);
    expect(await billing.hasFeature("cust-3", "reports")).toBe(true);
  });

  it("cancels immediately and revokes entitlements", async () => {
    const billing = memoryBilling();
    await billing.subscribe("cust-4", "pro");
    await billing.cancel("cust-4");
    const sub = await billing.getSubscription("cust-4");
    expect(sub?.status).toBe(SUBSCRIPTION_STATUS_CANCELED);
    expect(await billing.hasFeature("cust-4", "reports")).toBe(false);
  });

  it("returns no entitlements for unknown customers", async () => {
    const billing = memoryBilling();
    const entitlements = await billing.getEntitlements("nobody");
    expect(entitlements.features).toEqual([]);
    expect(entitlements.limits).toEqual({});
  });

  it("rejects unknown plans", async () => {
    const billing = memoryBilling();
    await expect(billing.subscribe("cust-5", "missing")).rejects.toThrow(
      /Unknown plan/,
    );
  });
});

describe("withEntitlement", () => {
  it("allows a customer whose plan includes the feature", async () => {
    const billing = memoryBilling();
    await billing.subscribe("cust-6", "pro");
    const handler = compose(
      [withEntitlement(billing, "reports", { customerId: () => "cust-6" })],
      async () => new Response("ok"),
    );
    expect((await handler(ctxFor())).status).toBe(200);
  });

  it("rejects a customer without the feature", async () => {
    const billing = memoryBilling();
    const handler = compose(
      [withEntitlement(billing, "reports", { customerId: () => "cust-7" })],
      async () => new Response("ok"),
    );
    await expect(handler(ctxFor())).rejects.toBeInstanceOf(ForbiddenError);
  });
});
