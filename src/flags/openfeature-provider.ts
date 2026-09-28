import {
  StandardResolutionReasons,
  type Provider,
} from "@openfeature/server-sdk";

/** Loads the full boolean flag map (cache or backing source). */
export type CacheLoader = () => Promise<Record<string, boolean>>;

/**
 * OpenFeature provider resolving boolean flags from a cached map loader.
 * String/number/object evaluations fall back to their defaults.
 */
export function createCacheBackedProvider(load: CacheLoader): Provider {
  return {
    metadata: { name: "cache-backed" },
    async resolveBooleanEvaluation(flagKey, defaultValue) {
      const flags = await load();
      const value = flags[flagKey];
      return value === undefined
        ? { value: defaultValue, reason: StandardResolutionReasons.DEFAULT }
        : { value, reason: StandardResolutionReasons.CACHED };
    },
    async resolveStringEvaluation(_flagKey, defaultValue) {
      return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
    },
    async resolveNumberEvaluation(_flagKey, defaultValue) {
      return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
    },
    async resolveObjectEvaluation(_flagKey, defaultValue) {
      return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
    },
  };
}
