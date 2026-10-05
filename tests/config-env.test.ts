import { describe, expect, it } from "bun:test";
import {
  readBoolEnv,
  readEnv,
  readEnvOrThrow,
  readListEnv,
} from "@/config/env.js";
import {
  BCRYPT_COST_DEFAULT,
  ENV_BCRYPT_COST,
  resolveBcryptCostFromEnv,
} from "@/constants/bcrypt-cost.js";
import {
  BOT_AI_CRAWLER_TOKENS,
  BOT_DETECTION_MODE_LOG,
  DEFAULT_BOT_DETECTION_MODE,
  ENV_BOT_ALLOW_EXTRA,
  ENV_BOT_BLOCK_EXTRA,
  ENV_BOT_DETECTION_MODE,
  resolveBotDetectionModeFromEnv,
  resolveBotTokenListsFromEnv,
} from "@/constants/bot.js";
import { parsePositiveIntEnv } from "@/constants/env-int.js";
import {
  DEFAULT_FEATURE_FLAG_CACHE_TTL_SECONDS,
  ENV_FEATURE_FLAGS_REMOTE,
  ENV_FEATURE_FLAG_CACHE_TTL_SECONDS,
  resolveFeatureFlagCacheTtlFromEnv,
  resolveFeatureFlagsRemoteFromEnv,
} from "@/constants/flags.js";
import {
  DEFAULT_MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  ENV_MAX_PAGE_SIZE,
  ENV_PAGE_SIZE,
  resolvePaginationConfigFromEnv,
} from "@/constants/pagination.js";
import {
  DEFAULT_CACHE_KEY_PREFIX,
  DEFAULT_CACHE_SESSION_TTL_SECONDS,
  DEFAULT_CACHE_USER_TTL_SECONDS,
  DEFAULT_REDIS_URL,
  ENV_CACHE_KEY_PREFIX,
  ENV_CACHE_SESSION_TTL_SECONDS,
  ENV_CACHE_USER_TTL_SECONDS,
  ENV_REDIS_URL,
  ENV_VALKEY_URL,
  resolveCacheKeyPrefixFromEnv,
  resolveCacheSessionTtlSecondsFromEnv,
  resolveCacheUserTtlSecondsFromEnv,
  resolveRedisUrlFromEnv,
  ttlSecondsUntilExpiry,
} from "@/constants/redis.js";
import {
  DEFAULT_BRUTE_FORCE_LOCK_SECONDS,
  DEFAULT_BRUTE_FORCE_MAX_ATTEMPTS,
  DEFAULT_BRUTE_FORCE_WINDOW_SECONDS,
  DEFAULT_CSRF_TTL_SECONDS,
  DEFAULT_MAX_URL_LENGTH,
  DEFAULT_REQUEST_TIMEOUT_MS,
  ENV_BRUTE_FORCE_MAX_ATTEMPTS,
  ENV_CSRF_TTL_SECONDS,
  ENV_MAX_URL_LENGTH,
  ENV_REQUEST_TIMEOUT_MS,
  resolveBruteForceConfigFromEnv,
  resolveCsrfTtlSecondsFromEnv,
  resolveMaxUrlLengthFromEnv,
  resolveRequestTimeoutMsFromEnv,
} from "@/constants/security.js";
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_SERVICE_NAME,
  ENV_HOST_KEY,
  ENV_PORT_KEY,
  ENV_SERVICE_NAME,
  HOST_DEVELOPMENT,
  HOST_PRODUCTION,
  resolveListenHost,
  resolveListenPort,
  resolveServiceNameFromEnv,
} from "@/constants/server.js";
import {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  ENV_SHUTDOWN_TIMEOUT_MS,
  resolveShutdownTimeoutMs,
  secondsToMs,
} from "@/constants/shutdown.js";
import { ENV_NODE_ENV, NODE_ENV_DEVELOPMENT } from "@/constants/tls-dev.js";

/** Temporarily applies process.env values, restoring prior state afterwards. */
function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => T,
): T {
  const saved = new Map(
    Object.keys(vars).map((key) => [key, process.env[key]] as const),
  );
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("config/env readers", () => {
  it("readEnv treats empty and missing values as undefined", () => {
    expect(readEnv("X", { X: "v" })).toBe("v");
    expect(readEnv("X", { X: "" })).toBeUndefined();
    expect(readEnv("X", {})).toBeUndefined();
  });

  it("readEnvOrThrow throws only when missing", () => {
    expect(readEnvOrThrow("X", { X: "v" })).toBe("v");
    expect(() => readEnvOrThrow("X", {})).toThrow("Missing required environment");
  });

  it("readBoolEnv accepts common truthy spellings", () => {
    expect(readBoolEnv("X", false, {})).toBe(false);
    expect(readBoolEnv("X", false, { X: "true" })).toBe(true);
    expect(readBoolEnv("X", false, { X: "1" })).toBe(true);
    expect(readBoolEnv("X", false, { X: "YES" })).toBe(true);
    expect(readBoolEnv("X", false, { X: "on" })).toBe(true);
    expect(readBoolEnv("X", false, { X: "no" })).toBe(false);
    expect(readBoolEnv("X", true, {})).toBe(true);
  });

  it("readListEnv splits, trims and drops blanks", () => {
    expect(readListEnv("X", ["a"], {})).toEqual(["a"]);
    expect(readListEnv("X", [], { X: " a , b ,, c " })).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("positive int env parsing", () => {
  it("returns the fallback for missing, invalid and non-positive values", () => {
    expect(parsePositiveIntEnv(undefined, 7)).toBe(7);
    expect(parsePositiveIntEnv("", 7)).toBe(7);
    expect(parsePositiveIntEnv("abc", 7)).toBe(7);
    expect(parsePositiveIntEnv("0", 7)).toBe(7);
    expect(parsePositiveIntEnv("-3", 7)).toBe(7);
    expect(parsePositiveIntEnv("12", 7)).toBe(12);
  });
});

describe("redis cache env resolution", () => {
  it("uses the configured prefix or the default", () => {
    expect(withEnv({ [ENV_CACHE_KEY_PREFIX]: "app:" }, resolveCacheKeyPrefixFromEnv)).toBe(
      "app:",
    );
    expect(
      withEnv({ [ENV_CACHE_KEY_PREFIX]: undefined }, resolveCacheKeyPrefixFromEnv),
    ).toBe(DEFAULT_CACHE_KEY_PREFIX);
  });

  it("resolves user/session TTLs with defaults", () => {
    expect(
      withEnv(
        {
          [ENV_CACHE_USER_TTL_SECONDS]: "120",
          [ENV_CACHE_SESSION_TTL_SECONDS]: undefined,
        },
        () => [resolveCacheUserTtlSecondsFromEnv(), resolveCacheSessionTtlSecondsFromEnv()],
      ),
    ).toEqual([120, DEFAULT_CACHE_SESSION_TTL_SECONDS]);
    expect(
      withEnv({ [ENV_CACHE_USER_TTL_SECONDS]: "abc" }, resolveCacheUserTtlSecondsFromEnv),
    ).toBe(DEFAULT_CACHE_USER_TTL_SECONDS);
    expect(DEFAULT_CACHE_USER_TTL_SECONDS).toBeGreaterThan(0);
  });

  it("prefers REDIS_URL, then VALKEY_URL, then the default", () => {
    expect(
      withEnv(
        { [ENV_REDIS_URL]: "redis://a:1", [ENV_VALKEY_URL]: "redis://b:2" },
        resolveRedisUrlFromEnv,
      ),
    ).toBe("redis://a:1");
    expect(
      withEnv({ [ENV_REDIS_URL]: undefined, [ENV_VALKEY_URL]: "redis://b:2" }, resolveRedisUrlFromEnv),
    ).toBe("redis://b:2");
    expect(
      withEnv({ [ENV_REDIS_URL]: undefined, [ENV_VALKEY_URL]: undefined }, resolveRedisUrlFromEnv),
    ).toBe(DEFAULT_REDIS_URL);
  });

  it("caps TTL by remaining lifetime", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(ttlSecondsUntilExpiry(future, 300)).toBeCloseTo(60, 0);
    expect(ttlSecondsUntilExpiry(future, 10)).toBe(10);
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(ttlSecondsUntilExpiry(past, 300)).toBe(1);
    expect(ttlSecondsUntilExpiry("not-a-date", 42)).toBe(42);
  });
});

describe("shutdown env resolution", () => {
  it("parses the timeout or falls back to the default", () => {
    expect(withEnv({ [ENV_SHUTDOWN_TIMEOUT_MS]: "2500" }, resolveShutdownTimeoutMs)).toBe(
      2500,
    );
    expect(
      withEnv({ [ENV_SHUTDOWN_TIMEOUT_MS]: "nope" }, resolveShutdownTimeoutMs),
    ).toBe(DEFAULT_SHUTDOWN_TIMEOUT_MS);
    expect(withEnv({ [ENV_SHUTDOWN_TIMEOUT_MS]: undefined }, resolveShutdownTimeoutMs)).toBe(
      DEFAULT_SHUTDOWN_TIMEOUT_MS,
    );
  });

  it("converts seconds to milliseconds", () => {
    expect(secondsToMs(2)).toBe(2000);
  });
});

describe("pagination + flags env resolution", () => {
  it("resolves pagination config with defaults", () => {
    expect(
      resolvePaginationConfigFromEnv({
        [ENV_PAGE_SIZE]: "5",
        [ENV_MAX_PAGE_SIZE]: "50",
      }),
    ).toEqual({ defaultPageSize: 5, maxPageSize: 50 });
    expect(resolvePaginationConfigFromEnv({})).toEqual({
      defaultPageSize: DEFAULT_PAGE_SIZE,
      maxPageSize: DEFAULT_MAX_PAGE_SIZE,
    });
  });

  it("resolves feature flag remote + cache TTL", () => {
    expect(resolveFeatureFlagsRemoteFromEnv({ [ENV_FEATURE_FLAGS_REMOTE]: "true" })).toBe(
      true,
    );
    expect(resolveFeatureFlagsRemoteFromEnv({})).toBe(false);
    expect(
      resolveFeatureFlagCacheTtlFromEnv({ [ENV_FEATURE_FLAG_CACHE_TTL_SECONDS]: "90" }),
    ).toBe(90);
    expect(resolveFeatureFlagCacheTtlFromEnv({})).toBe(
      DEFAULT_FEATURE_FLAG_CACHE_TTL_SECONDS,
    );
  });
});

describe("security limits env resolution", () => {
  it("resolves request timeout and max url length", () => {
    expect(
      resolveRequestTimeoutMsFromEnv({ [ENV_REQUEST_TIMEOUT_MS]: "1500" }),
    ).toBe(1500);
    expect(resolveRequestTimeoutMsFromEnv({})).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    expect(resolveMaxUrlLengthFromEnv({ [ENV_MAX_URL_LENGTH]: "512" })).toBe(512);
    expect(resolveMaxUrlLengthFromEnv({})).toBe(DEFAULT_MAX_URL_LENGTH);
  });

  it("resolves csrf ttl and brute-force thresholds", () => {
    expect(resolveCsrfTtlSecondsFromEnv({ [ENV_CSRF_TTL_SECONDS]: "60" })).toBe(60);
    expect(resolveCsrfTtlSecondsFromEnv({})).toBe(DEFAULT_CSRF_TTL_SECONDS);
    expect(
      resolveBruteForceConfigFromEnv({ [ENV_BRUTE_FORCE_MAX_ATTEMPTS]: "3" }),
    ).toEqual({
      maxAttempts: 3,
      windowSeconds: DEFAULT_BRUTE_FORCE_WINDOW_SECONDS,
      lockSeconds: DEFAULT_BRUTE_FORCE_LOCK_SECONDS,
    });
    expect(resolveBruteForceConfigFromEnv({})).toEqual({
      maxAttempts: DEFAULT_BRUTE_FORCE_MAX_ATTEMPTS,
      windowSeconds: DEFAULT_BRUTE_FORCE_WINDOW_SECONDS,
      lockSeconds: DEFAULT_BRUTE_FORCE_LOCK_SECONDS,
    });
  });
});

describe("bcrypt cost env resolution", () => {
  it("returns the default when unset and parses valid values", () => {
    withEnv({ [ENV_BCRYPT_COST]: undefined }, () => {
      expect(resolveBcryptCostFromEnv()).toBe(BCRYPT_COST_DEFAULT);
    });
    expect(withEnv({ [ENV_BCRYPT_COST]: "10" }, resolveBcryptCostFromEnv)).toBe(10);
  });

  it("rejects out-of-range or non-integer values", () => {
    expect(() => withEnv({ [ENV_BCRYPT_COST]: "3" }, resolveBcryptCostFromEnv)).toThrow(
      ENV_BCRYPT_COST,
    );
    expect(() => withEnv({ [ENV_BCRYPT_COST]: "99" }, resolveBcryptCostFromEnv)).toThrow(
      ENV_BCRYPT_COST,
    );
    expect(() => withEnv({ [ENV_BCRYPT_COST]: "x" }, resolveBcryptCostFromEnv)).toThrow(
      ENV_BCRYPT_COST,
    );
  });
});

describe("server env resolution", () => {
  it("resolves service name, port and host", () => {
    expect(resolveServiceNameFromEnv()).toBeDefined();
    expect(
      withEnv({ [ENV_SERVICE_NAME]: "api" }, resolveServiceNameFromEnv),
    ).toBe("api");
    expect(
      withEnv({ [ENV_SERVICE_NAME]: undefined }, resolveServiceNameFromEnv),
    ).toBe(DEFAULT_SERVICE_NAME);
    expect(withEnv({ [ENV_PORT_KEY]: "8080" }, resolveListenPort)).toBe(8080);
    expect(withEnv({ [ENV_PORT_KEY]: "nope" }, resolveListenPort)).toBe(
      DEFAULT_HTTP_PORT,
    );
    expect(withEnv({ [ENV_PORT_KEY]: undefined }, resolveListenPort)).toBe(
      DEFAULT_HTTP_PORT,
    );
    expect(withEnv({ [ENV_HOST_KEY]: "10.0.0.1" }, resolveListenHost)).toBe(
      "10.0.0.1",
    );
    expect(
      withEnv(
        { [ENV_HOST_KEY]: undefined, [ENV_NODE_ENV]: NODE_ENV_DEVELOPMENT },
        resolveListenHost,
      ),
    ).toBe(HOST_DEVELOPMENT);
    expect(
      withEnv({ [ENV_HOST_KEY]: undefined, [ENV_NODE_ENV]: "production" }, resolveListenHost),
    ).toBe(HOST_PRODUCTION);
  });
});

describe("bot detection env resolution", () => {
  it("resolves the mode with a default for unknown values", () => {
    expect(
      withEnv({ [ENV_BOT_DETECTION_MODE]: "log" }, resolveBotDetectionModeFromEnv),
    ).toBe(BOT_DETECTION_MODE_LOG);
    expect(
      withEnv({ [ENV_BOT_DETECTION_MODE]: "LOG" }, resolveBotDetectionModeFromEnv),
    ).toBe(BOT_DETECTION_MODE_LOG);
    expect(
      withEnv({ [ENV_BOT_DETECTION_MODE]: "nonsense" }, resolveBotDetectionModeFromEnv),
    ).toBe(DEFAULT_BOT_DETECTION_MODE);
    expect(
      withEnv({ [ENV_BOT_DETECTION_MODE]: undefined }, resolveBotDetectionModeFromEnv),
    ).toBe(DEFAULT_BOT_DETECTION_MODE);
  });

  it("appends extra allow/block tokens, normalized", () => {
    const lists = withEnv(
      {
        [ENV_BOT_ALLOW_EXTRA]: "MyEngine, TrustedBot",
        [ENV_BOT_BLOCK_EXTRA]: "EvilBot\nOtherBot",
      },
      resolveBotTokenListsFromEnv,
    );
    expect(lists.searchEngines).toContain("myengine");
    expect(lists.searchEngines).toContain("trustedbot");
    expect(lists.aiCrawlers).toContain("evilbot");
    expect(lists.aiCrawlers).toContain("otherbot");
    expect(lists.aiCrawlers).toContain(BOT_AI_CRAWLER_TOKENS[0]);
  });
});
