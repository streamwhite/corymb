export const BOT_DETECTION_MODE_OFF = "off" as const;

export const BOT_DETECTION_MODE_LOG = "log" as const;

export const BOT_DETECTION_MODE_BLOCK = "block" as const;

export type BotDetectionMode =
  | typeof BOT_DETECTION_MODE_OFF
  | typeof BOT_DETECTION_MODE_LOG
  | typeof BOT_DETECTION_MODE_BLOCK;

export const ENV_BOT_DETECTION_MODE = "BOT_DETECTION_MODE" as const;

/** Comma/space separated extra tokens appended to the AI-crawler block list. */
export const ENV_BOT_BLOCK_EXTRA = "BOT_BLOCK_EXTRA" as const;

/** Comma/space separated extra tokens appended to the search-engine allow list. */
export const ENV_BOT_ALLOW_EXTRA = "BOT_ALLOW_EXTRA" as const;

export const DEFAULT_BOT_DETECTION_MODE: BotDetectionMode =
  BOT_DETECTION_MODE_BLOCK;

/** Search engine crawlers — always allowed (checked before the block list). */
export const BOT_SEARCH_ENGINE_TOKENS: readonly string[] = [
  "googlebot",
  "bingbot",
  "duckduckbot",
  "applebot",
  "baiduspider",
  "yandex",
  "sogou",
  "slurp",
  "petalbot",
  "seznambot",
  "qwantify",
  "exabot",
];

/** AI training / answer crawlers — blocked by default. */
export const BOT_AI_CRAWLER_TOKENS: readonly string[] = [
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "claude-web",
  "anthropic-ai",
  "ccbot",
  "perplexitybot",
  "bytespider",
  "amazonbot",
  "meta-externalagent",
  "meta-externalfetcher",
  "google-extended",
  "cohere-ai",
  "diffbot",
  "omgili",
  "timpibot",
  "imagesiftbot",
  "youbot",
];

/** Command-line / script clients — reported but not blocked by default. */
export const BOT_TOOL_TOKENS: readonly string[] = [
  "curl",
  "wget",
  "python-requests",
  "python-urllib",
  "go-http-client",
  "java/",
  "okhttp",
  "headlesschrome",
  "phantomjs",
  "postmanruntime",
  "insomnia",
];

export type BotTokenLists = {
  searchEngines: readonly string[];
  aiCrawlers: readonly string[];
  tools: readonly string[];
};

const TOKEN_SEPARATOR = /[\s,]+/;

function parseTokenList(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(TOKEN_SEPARATOR)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

export function resolveBotDetectionModeFromEnv(): BotDetectionMode {
  const raw = process.env[ENV_BOT_DETECTION_MODE]?.trim().toLowerCase();
  if (
    raw === BOT_DETECTION_MODE_OFF ||
    raw === BOT_DETECTION_MODE_LOG ||
    raw === BOT_DETECTION_MODE_BLOCK
  ) {
    return raw;
  }
  return DEFAULT_BOT_DETECTION_MODE;
}

export function resolveBotTokenListsFromEnv(): BotTokenLists {
  return {
    searchEngines: [
      ...BOT_SEARCH_ENGINE_TOKENS,
      ...parseTokenList(process.env[ENV_BOT_ALLOW_EXTRA]),
    ],
    aiCrawlers: [
      ...BOT_AI_CRAWLER_TOKENS,
      ...parseTokenList(process.env[ENV_BOT_BLOCK_EXTRA]),
    ],
    tools: BOT_TOOL_TOKENS,
  };
}
