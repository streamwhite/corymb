import { isBot } from "isbot";
import type { BotDetectionMode, BotTokenLists } from "@/constants/bot.js";
import { BOT_DETECTION_MODE_BLOCK } from "@/constants/bot.js";

export type BotKind =
  | "human"
  | "search-engine"
  | "ai-crawler"
  | "tool"
  | "other-bot";

export type BotClassification = {
  isBot: boolean;
  kind: BotKind;
};

function matchesAny(ua: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => ua.includes(token));
}

/** Classify a user agent into a bot kind. Empty/missing UA is treated as human. */
export function classifyUserAgent(
  ua: string | null,
  tokens: BotTokenLists,
): BotClassification {
  if (ua === null || ua.trim().length === 0) {
    return { isBot: false, kind: "human" };
  }
  if (!isBot(ua)) {
    return { isBot: false, kind: "human" };
  }
  const normalized = ua.toLowerCase();
  if (matchesAny(normalized, tokens.searchEngines)) {
    return { isBot: true, kind: "search-engine" };
  }
  if (matchesAny(normalized, tokens.aiCrawlers)) {
    return { isBot: true, kind: "ai-crawler" };
  }
  if (matchesAny(normalized, tokens.tools)) {
    return { isBot: true, kind: "tool" };
  }
  return { isBot: true, kind: "other-bot" };
}

/** Only AI crawlers are blocked, and only in `block` mode. */
export function shouldBlockBot(
  kind: BotKind,
  mode: BotDetectionMode,
): boolean {
  return mode === BOT_DETECTION_MODE_BLOCK && kind === "ai-crawler";
}
