import { describe, expect, it } from "bun:test";
import {
  classifyUserAgent,
  shouldBlockBot,
  type BotKind,
} from "@/bot/bot-detection.js";
import {
  BOT_AI_CRAWLER_TOKENS,
  BOT_SEARCH_ENGINE_TOKENS,
  BOT_TOOL_TOKENS,
  type BotTokenLists,
} from "@/constants/bot.js";

const tokens: BotTokenLists = {
  searchEngines: BOT_SEARCH_ENGINE_TOKENS,
  aiCrawlers: BOT_AI_CRAWLER_TOKENS,
  tools: BOT_TOOL_TOKENS,
};

const HUMAN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot";
const CURL_UA = "curl/8.5.0";

function kindOf(ua: string | null): BotKind {
  return classifyUserAgent(ua, tokens).kind;
}

describe("classifyUserAgent", () => {
  it("treats a normal browser as human", () => {
    expect(classifyUserAgent(HUMAN_UA, tokens)).toEqual({
      isBot: false,
      kind: "human",
    });
  });

  it("treats an empty or missing user agent as human", () => {
    expect(kindOf("")).toBe("human");
    expect(kindOf(null)).toBe("human");
  });

  it("classifies search engine crawlers", () => {
    expect(kindOf(GOOGLEBOT_UA)).toBe("search-engine");
  });

  it("classifies AI crawlers", () => {
    expect(kindOf(GPTBOT_UA)).toBe("ai-crawler");
  });

  it("classifies command-line tools", () => {
    expect(kindOf(CURL_UA)).toBe("tool");
  });

  it("falls back to other-bot for unrecognized bots", () => {
    expect(classifyUserAgent("SomeUnknownBot/1.0", tokens)).toEqual({
      isBot: true,
      kind: "other-bot",
    });
  });

  it("lets the allow list win over the block list", () => {
    const withOverride: BotTokenLists = {
      ...tokens,
      searchEngines: [...tokens.searchEngines, "gptbot"],
    };
    expect(classifyUserAgent(GPTBOT_UA, withOverride).kind).toBe(
      "search-engine",
    );
  });
});

describe("shouldBlockBot", () => {
  it("blocks AI crawlers in block mode", () => {
    expect(shouldBlockBot("ai-crawler", "block")).toBe(true);
  });

  it("does not block search engines or tools by default", () => {
    expect(shouldBlockBot("search-engine", "block")).toBe(false);
    expect(shouldBlockBot("tool", "block")).toBe(false);
    expect(shouldBlockBot("human", "block")).toBe(false);
  });

  it("never blocks in log or off mode", () => {
    expect(shouldBlockBot("ai-crawler", "log")).toBe(false);
    expect(shouldBlockBot("ai-crawler", "off")).toBe(false);
  });
});
