import { describe, expect, it } from "bun:test";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { FEATURE_FLAG_CACHE_KEY } from "@/constants/flags.js";
import { NotFoundError } from "@/errors/app-error.js";
import { withFeatureFlag } from "@/flags/feature-flag-middleware.js";
import { InMemoryProvider } from "@openfeature/server-sdk";
import {
  createCachedFeatureFlags,
  createEnvFeatureFlags,
  createOpenFeatureFlags,
  createStaticFeatureFlags,
  parseFeatureFlags,
} from "@/flags/feature-flags.js";
import { compose } from "@/middleware/compose.js";
import type { MiddlewareContext } from "@/middleware/middleware-types.js";
import { createLogger } from "@/observability/logger.js";

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

describe("feature flag parsing", () => {
  it("parses a comma-separated list of enabled flags", () => {
    expect(parseFeatureFlags("new-ui, beta ,,")).toEqual({
      "new-ui": true,
      beta: true,
    });
  });

  it("parses a JSON map", () => {
    expect(parseFeatureFlags('{"a":true,"b":false}')).toEqual({
      a: true,
      b: false,
    });
  });

  it("returns an empty map for blank or invalid input", () => {
    expect(parseFeatureFlags(undefined)).toEqual({});
    expect(parseFeatureFlags("   ")).toEqual({});
    expect(parseFeatureFlags("{not-json")).toEqual({});
  });
});

describe("feature flag providers", () => {
  it("reads flags from env", async () => {
    const flags = createEnvFeatureFlags({ FEATURE_FLAGS: "alpha,beta" });
    expect(await flags.isEnabled("alpha")).toBe(true);
    expect(await flags.isEnabled("missing")).toBe(false);
    expect(await flags.all()).toEqual({ alpha: true, beta: true });
  });

  it("evaluates targeting rules through OpenFeature context", async () => {
    const provider = new InMemoryProvider({
      "new-ui": {
        variants: { on: true, off: false },
        defaultVariant: "off",
        disabled: false,
        contextEvaluator: (context) =>
          context?.targetingKey === "user-1" ? "on" : "off",
      },
    });
    const flags = createOpenFeatureFlags({ provider, flags: { "new-ui": false } });
    expect(await flags.isEnabled("new-ui", { targetingKey: "user-1" })).toBe(true);
    expect(await flags.isEnabled("new-ui", { targetingKey: "other" })).toBe(false);
    expect(await flags.all()).toEqual({ "new-ui": false });
  });

  it("caches an upstream provider", async () => {
    const cache = createMemoryCache();
    let calls = 0;
    const source = {
      isEnabled: async () => false,
      all: async () => {
        calls += 1;
        return { gamma: true };
      },
    };
    const flags = createCachedFeatureFlags({ cache, source });
    expect(await flags.isEnabled("gamma")).toBe(true);
    expect(await flags.isEnabled("gamma")).toBe(true);
    expect(calls).toBe(1);
  });

  it("falls back to the source when the cached flag map is corrupt", async () => {
    const cache = createMemoryCache();
    await cache.set(FEATURE_FLAG_CACHE_KEY, "{not json", 30);
    const source = {
      isEnabled: async () => true,
      all: async () => ({ recovered: true }),
    };
    const flags = createCachedFeatureFlags({ cache, source });
    expect(await flags.all()).toEqual({ recovered: true });
    expect(await flags.isEnabled("recovered")).toBe(true);
  });

  it("supports a named OpenFeature domain", async () => {
    const flags = createOpenFeatureFlags({
      flags: { "domain-flag": true },
      domain: "tenant-a",
    });
    expect(await flags.isEnabled("domain-flag")).toBe(true);
  });

  it("uses a custom listFlags enumeration when provided", async () => {
    const flags = createOpenFeatureFlags({
      listFlags: async () => ({ custom: true }),
    });
    expect(await flags.all()).toEqual({ custom: true });
  });
});

describe("withFeatureFlag", () => {
  it("passes when the flag is enabled", async () => {
    const flags = createStaticFeatureFlags({ on: true });
    const handler = compose([withFeatureFlag(flags, "on")], async () =>
      new Response("ok"),
    );
    expect((await handler(ctxFor())).status).toBe(200);
  });

  it("hides the route when the flag is disabled", async () => {
    const flags = createStaticFeatureFlags({});
    const handler = compose([withFeatureFlag(flags, "off")], async () =>
      new Response("ok"),
    );
    await expect(handler(ctxFor())).rejects.toBeInstanceOf(NotFoundError);
  });
});
