import {
  InMemoryProvider,
  OpenFeatureAPI,
  type EvaluationContext,
  type InMemoryFlagConfiguration,
  type Provider,
} from "@openfeature/server-sdk";
import type { Cache } from "@/cache/cache-types.js";
import { readEnv } from "@/config/env.js";
import {
  DEFAULT_FEATURE_FLAG_CACHE_TTL_SECONDS,
  ENV_FEATURE_FLAGS,
  FEATURE_FLAG_CACHE_KEY,
} from "@/constants/flags.js";
import { createCacheBackedProvider } from "@/flags/openfeature-provider.js";

/** Standard OpenFeature evaluation context (targetingKey, user, ...). */
export type FeatureFlagContext = EvaluationContext;

export type FeatureFlags = {
  isEnabled: (name: string, context?: FeatureFlagContext) => Promise<boolean>;
  all: () => Promise<Record<string, boolean>>;
};

const EMPTY_FLAGS: Record<string, boolean> = {};

function toBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function toBooleanMap(input: Record<string, unknown>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [name, value] of Object.entries(input)) {
    out[name] = toBoolean(value);
  }
  return out;
}

/**
 * Parses `FEATURE_FLAGS` as a JSON object (`{"a":true}`) or a comma-separated
 * list of enabled names (`a,b`).
 */
export function parseFeatureFlags(
  raw: string | undefined,
): Record<string, boolean> {
  if (raw === undefined || raw.trim().length === 0) {
    return { ...EMPTY_FLAGS };
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return toBooleanMap(parsed as Record<string, unknown>);
      }
    } catch {
      return { ...EMPTY_FLAGS };
    }
    return { ...EMPTY_FLAGS };
  }
  const out: Record<string, boolean> = {};
  for (const name of trimmed.split(",")) {
    const key = name.trim();
    if (key.length > 0) {
      out[key] = true;
    }
  }
  return out;
}

/** Converts a boolean flag map into an OpenFeature in-memory configuration. */
export function toInMemoryConfiguration(
  flags: Record<string, boolean>,
): InMemoryFlagConfiguration {
  const configuration: Record<string, unknown> = {};
  for (const [name, enabled] of Object.entries(flags)) {
    configuration[name] = {
      variants: { on: enabled, off: !enabled },
      defaultVariant: enabled ? "on" : "off",
      disabled: false,
    };
  }
  return configuration as InMemoryFlagConfiguration;
}

export type OpenFeatureFlagsOptions = {
  /** Evaluation provider; defaults to an in-memory provider built from `flags`. */
  provider?: Provider;
  /** Flag map used for the default provider and for `all()` enumeration. */
  flags?: Record<string, boolean>;
  /** Default evaluation context (targetingKey, user, ...). */
  context?: FeatureFlagContext;
  /** Bind the provider to a named domain instead of the default. */
  domain?: string;
  /** Overrides `all()` enumeration (e.g. dynamic/cached sources). */
  listFlags?: () => Promise<Record<string, boolean>>;
};

/**
 * Builds a `FeatureFlags` facade backed by an OpenFeature client. A fresh
 * `OpenFeatureAPI` instance is used so facades stay isolated per app.
 */
export function createOpenFeatureFlags(
  options: OpenFeatureFlagsOptions = {},
): FeatureFlags {
  const flags = options.flags ?? {};
  const provider =
    options.provider ?? new InMemoryProvider(toInMemoryConfiguration(flags));
  const api = new OpenFeatureAPI();
  const domain = options.domain;
  const clientPromise = (async () => {
    if (domain === undefined) {
      await api.setProviderAndWait(provider);
      return api.getClient(options.context);
    }
    await api.setProviderAndWait(domain, provider);
    return api.getClient(domain, options.context);
  })();
  const knownNames = Object.keys(flags);

  return {
    async isEnabled(name, context) {
      const client = await clientPromise;
      return client.getBooleanValue(name, false, context);
    },
    async all() {
      if (options.listFlags !== undefined) {
        return options.listFlags();
      }
      const client = await clientPromise;
      const entries = await Promise.all(
        knownNames.map(
          async (name) =>
            [name, await client.getBooleanValue(name, false)] as const,
        ),
      );
      return Object.fromEntries(entries);
    },
  };
}

/** In-memory provider over a fixed flag map (tests, defaults). */
export function createStaticFeatureFlags(
  flags: Record<string, boolean> = {},
): FeatureFlags {
  return createOpenFeatureFlags({ flags });
}

/** Reads flags from the `FEATURE_FLAGS` env variable. */
export function createEnvFeatureFlags(
  env: Record<string, string | undefined> = process.env,
): FeatureFlags {
  return createStaticFeatureFlags(parseFeatureFlags(readEnv(ENV_FEATURE_FLAGS, env)));
}

export type CachedFeatureFlagsOptions = {
  cache: Cache;
  /** Upstream source to refresh from; defaults to env flags. */
  source?: FeatureFlags;
  ttlSeconds?: number;
  key?: string;
};

/**
 * OpenFeature provider that reads a JSON flag map from the cache, refreshing
 * from `source` when cold. Lets replicas share overrides without per-request IO.
 */
export function createCachedFeatureFlags(
  options: CachedFeatureFlagsOptions,
): FeatureFlags {
  const source = options.source ?? createEnvFeatureFlags();
  const key = options.key ?? FEATURE_FLAG_CACHE_KEY;
  const ttlSeconds =
    options.ttlSeconds ?? DEFAULT_FEATURE_FLAG_CACHE_TTL_SECONDS;

  const load = async (): Promise<Record<string, boolean>> => {
    const cached = await options.cache.get(key);
    if (cached !== null) {
      try {
        return JSON.parse(cached) as Record<string, boolean>;
      } catch {
        return source.all();
      }
    }
    const fresh = await source.all();
    await options.cache.set(key, JSON.stringify(fresh), ttlSeconds).catch(() => {});
    return fresh;
  };

  return createOpenFeatureFlags({
    provider: createCacheBackedProvider(load),
    listFlags: load,
  });
}
