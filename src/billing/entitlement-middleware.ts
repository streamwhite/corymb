import type { Billing } from "@/billing/billing-types.js";
import { ForbiddenError } from "@/errors/app-error.js";
import type { Middleware, MiddlewareContext } from "@/middleware/middleware-types.js";

export type EntitlementOptions = {
  /** Resolves the billing customer id (e.g. from the session user). */
  customerId: (
    ctx: MiddlewareContext,
  ) => string | undefined | Promise<string | undefined>;
};

/** Allows the request only when the customer's plan includes `feature`. */
export function withEntitlement(
  billing: Billing,
  feature: string,
  options: EntitlementOptions,
): Middleware {
  return async (ctx, next) => {
    const customerId = await options.customerId(ctx);
    if (
      customerId === undefined ||
      !(await billing.hasFeature(customerId, feature))
    ) {
      throw new ForbiddenError();
    }
    return next();
  };
}
