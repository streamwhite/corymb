import { NotFoundError } from "@/errors/app-error.js";
import type {
  FeatureFlagContext,
  FeatureFlags,
} from "@/flags/feature-flags.js";
import type { Middleware, MiddlewareContext } from "@/middleware/middleware-types.js";

export type FeatureFlagGateOptions = {
  /** Derives the evaluation context (user/tenant) from the request. */
  flagContext?: (
    ctx: MiddlewareContext,
  ) => FeatureFlagContext | undefined | Promise<FeatureFlagContext | undefined>;
};

/** Hides a route (404) unless the named flag is enabled for the requester. */
export function withFeatureFlag(
  flags: FeatureFlags,
  name: string,
  options: FeatureFlagGateOptions = {},
): Middleware {
  return async (ctx, next) => {
    const context = await options.flagContext?.(ctx);
    if (!(await flags.isEnabled(name, context))) {
      throw new NotFoundError();
    }
    return next();
  };
}
