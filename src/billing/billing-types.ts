export const SUBSCRIPTION_STATUS_ACTIVE = "active" as const;
export const SUBSCRIPTION_STATUS_TRIALING = "trialing" as const;
export const SUBSCRIPTION_STATUS_PAST_DUE = "past_due" as const;
export const SUBSCRIPTION_STATUS_CANCELED = "canceled" as const;

export type SubscriptionStatus =
  | typeof SUBSCRIPTION_STATUS_ACTIVE
  | typeof SUBSCRIPTION_STATUS_TRIALING
  | typeof SUBSCRIPTION_STATUS_PAST_DUE
  | typeof SUBSCRIPTION_STATUS_CANCELED;

export const BILLING_INTERVAL_MONTH = "month" as const;
export const BILLING_INTERVAL_YEAR = "year" as const;

export type BillingInterval =
  | typeof BILLING_INTERVAL_MONTH
  | typeof BILLING_INTERVAL_YEAR;

export type Plan = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: BillingInterval;
  features: string[];
  /** Numeric limits per key (e.g. `{ seats: 5 }`). */
  limits?: Record<string, number>;
};

export type Subscription = {
  id: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
};

export type Entitlements = {
  planId: string;
  status: SubscriptionStatus;
  features: string[];
  limits: Record<string, number>;
};

export type CancelOptions = { atPeriodEnd?: boolean };

/**
 * Provider-agnostic billing contract. Implementations may wrap Stripe, Paddle,
 * Lago, or an in-memory store; the framework only depends on this shape.
 */
export type BillingProvider = {
  listPlans: () => Promise<Plan[]>;
  getPlan: (planId: string) => Promise<Plan | null>;
  getSubscription: (customerId: string) => Promise<Subscription | null>;
  subscribe: (customerId: string, planId: string) => Promise<Subscription>;
  changePlan: (customerId: string, planId: string) => Promise<Subscription>;
  cancel: (
    customerId: string,
    options?: CancelOptions,
  ) => Promise<Subscription | null>;
  getEntitlements: (customerId: string) => Promise<Entitlements>;
};

/** Billing provider plus convenience entitlement checks. */
export type Billing = BillingProvider & {
  hasFeature: (customerId: string, feature: string) => Promise<boolean>;
  getLimit: (customerId: string, key: string) => Promise<number>;
};
