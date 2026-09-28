import {
  BILLING_INTERVAL_YEAR,
  SUBSCRIPTION_STATUS_ACTIVE,
  SUBSCRIPTION_STATUS_CANCELED,
  type Billing,
  type BillingInterval,
  type BillingProvider,
  type CancelOptions,
  type Entitlements,
  type Plan,
  type Subscription,
} from "@/billing/billing-types.js";

const EMPTY_ENTITLEMENTS: Entitlements = {
  planId: "",
  status: SUBSCRIPTION_STATUS_CANCELED,
  features: [],
  limits: {},
};

function nextPeriodEnd(now: Date, interval: BillingInterval): string {
  const end = new Date(now);
  if (interval === BILLING_INTERVAL_YEAR) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end.toISOString();
}

/** Adds entitlement helpers around any provider. */
export function createBilling(provider: BillingProvider): Billing {
  return {
    listPlans: () => provider.listPlans(),
    getPlan: (planId) => provider.getPlan(planId),
    getSubscription: (customerId) => provider.getSubscription(customerId),
    subscribe: (customerId, planId) => provider.subscribe(customerId, planId),
    changePlan: (customerId, planId) => provider.changePlan(customerId, planId),
    cancel: (customerId, options) => provider.cancel(customerId, options),
    getEntitlements: (customerId) => provider.getEntitlements(customerId),
    async hasFeature(customerId, feature) {
      const entitlements = await provider.getEntitlements(customerId);
      return entitlements.features.includes(feature);
    },
    async getLimit(customerId, key) {
      const entitlements = await provider.getEntitlements(customerId);
      return entitlements.limits[key] ?? 0;
    },
  };
}

export type MemoryBillingOptions = {
  plans?: Plan[];
  now?: () => Date;
  idFactory?: () => string;
};

export type MemoryBillingProvider = BillingProvider & {
  /** Inserts or replaces a plan. */
  upsertPlan: (plan: Plan) => void;
  /** Directly seeds a subscription (tests/fixtures). */
  setSubscription: (subscription: Subscription) => void;
};

/**
 * In-memory billing provider for tests, local development and as a reference
 * implementation. No external payment calls are made.
 */
export function createMemoryBillingProvider(
  options: MemoryBillingOptions = {},
): MemoryBillingProvider {
  const plans = new Map<string, Plan>();
  for (const plan of options.plans ?? []) {
    plans.set(plan.id, plan);
  }
  const subscriptions = new Map<string, Subscription>();
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());

  const requirePlan = (planId: string): Plan => {
    const plan = plans.get(planId);
    if (plan === undefined) {
      throw new Error(`Unknown plan: ${planId}`);
    }
    return plan;
  };

  const entitlementsFor = (subscription: Subscription | undefined): Entitlements => {
    if (
      subscription === undefined ||
      subscription.status === SUBSCRIPTION_STATUS_CANCELED
    ) {
      return { ...EMPTY_ENTITLEMENTS };
    }
    const plan = plans.get(subscription.planId);
    return {
      planId: subscription.planId,
      status: subscription.status,
      features: plan?.features ?? [],
      limits: plan?.limits ?? {},
    };
  };

  return {
    upsertPlan(plan) {
      plans.set(plan.id, plan);
    },
    setSubscription(subscription) {
      subscriptions.set(subscription.customerId, subscription);
    },
    async listPlans() {
      return [...plans.values()];
    },
    async getPlan(planId) {
      return plans.get(planId) ?? null;
    },
    async getSubscription(customerId) {
      return subscriptions.get(customerId) ?? null;
    },
    async subscribe(customerId, planId) {
      const plan = requirePlan(planId);
      const subscription: Subscription = {
        id: idFactory(),
        customerId,
        planId,
        status: SUBSCRIPTION_STATUS_ACTIVE,
        currentPeriodEnd: nextPeriodEnd(now(), plan.interval),
        cancelAtPeriodEnd: false,
      };
      subscriptions.set(customerId, subscription);
      return subscription;
    },
    async changePlan(customerId, planId) {
      const current = subscriptions.get(customerId);
      if (current === undefined) {
        throw new Error(`No subscription for customer: ${customerId}`);
      }
      const plan = requirePlan(planId);
      const subscription: Subscription = {
        ...current,
        planId,
        status: SUBSCRIPTION_STATUS_ACTIVE,
        currentPeriodEnd: nextPeriodEnd(now(), plan.interval),
        cancelAtPeriodEnd: false,
      };
      subscriptions.set(customerId, subscription);
      return subscription;
    },
    async cancel(customerId, cancelOptions?: CancelOptions) {
      const current = subscriptions.get(customerId);
      if (current === undefined) {
        return null;
      }
      const subscription: Subscription =
        cancelOptions?.atPeriodEnd === true
          ? { ...current, cancelAtPeriodEnd: true }
          : { ...current, status: SUBSCRIPTION_STATUS_CANCELED };
      subscriptions.set(customerId, subscription);
      return subscription;
    },
    async getEntitlements(customerId) {
      return entitlementsFor(subscriptions.get(customerId));
    },
  };
}
