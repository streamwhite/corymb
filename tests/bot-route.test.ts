import { afterEach, describe, expect, it } from "bun:test";
import { setBotDetectionModeForTests } from "@/bot/bot-guard.js";
import {
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from "@/constants/http-status.js";
import { MSG_BOT_BLOCKED, MSG_HTTP_NOT_FOUND } from "@/constants/messages.js";
import { HEALTH_BASE_PATH, ROBOTS_TXT_PATH } from "@/constants/routes.js";
import { createMemoryApp } from "./helpers/app-memory.js";

const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot";
const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CURL_UA = "curl/8.5.0";
const HUMAN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function withUserAgent(ua: string): { headers: Record<string, string> } {
  return { headers: { "User-Agent": ua } };
}

describe("bot detection on routes", () => {
  afterEach(() => {
    setBotDetectionModeForTests(undefined);
  });

  it("blocks an AI crawler on built-in routes", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(HEALTH_BASE_PATH, withUserAgent(GPTBOT_UA));
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_BOT_BLOCKED);
  });

  it("allows search engine crawlers", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(
      HEALTH_BASE_PATH,
      withUserAgent(GOOGLEBOT_UA),
    );
    expect(res.status).toBe(HTTP_STATUS_OK);
  });

  it("allows command-line tools by default", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(HEALTH_BASE_PATH, withUserAgent(CURL_UA));
    expect(res.status).toBe(HTTP_STATUS_OK);
  });

  it("allows normal browsers", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(HEALTH_BASE_PATH, withUserAgent(HUMAN_UA));
    expect(res.status).toBe(HTTP_STATUS_OK);
  });

  it("blocks bots on the fetch fallback 404", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(
      "/no-such-route",
      withUserAgent(GPTBOT_UA),
    );
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN);
  });

  it("keeps the JSON 404 for non-bots on the fallback", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request("/no-such-route", withUserAgent(HUMAN_UA));
    expect(res.status).toBe(HTTP_STATUS_NOT_FOUND);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_HTTP_NOT_FOUND);
  });

  it("serves robots.txt with allow + AI crawler disallow rules", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(ROBOTS_TXT_PATH);
    expect(res.status).toBe(HTTP_STATUS_OK);
    expect(res.headers.get("content-type") ?? "").toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");
    expect(text).toContain("gptbot");
    expect(text).toContain("Disallow: /");
  });

  it("lets bots through when mode is off", async () => {
    setBotDetectionModeForTests("off");
    const { app } = await createMemoryApp();
    const res = await app.request(HEALTH_BASE_PATH, withUserAgent(GPTBOT_UA));
    expect(res.status).toBe(HTTP_STATUS_OK);
  });
});
