import type { BotTokenLists } from "@/constants/bot.js";
import { resolveBotTokenListsFromEnv } from "@/constants/bot.js";
import { HTTP_STATUS_FORBIDDEN } from "@/constants/http-status.js";
import { MSG_BOT_BLOCKED } from "@/constants/messages.js";
import { jsonApiResponse } from "@/http/json-response.js";
import { withSecurityHeadersFromRequest } from "@/http/security-headers.js";

const MIME_TEXT_PLAIN_UTF8 = "text/plain; charset=utf-8" as const;

const ROBOTS_USER_AGENT = "User-agent" as const;
const ROBOTS_ALLOW = "Allow" as const;
const ROBOTS_DISALLOW = "Disallow" as const;
const ROBOTS_WILDCARD = "*" as const;
const ROBOTS_ROOT = "/" as const;
const LINE_BREAK = "\n" as const;

export function blockedBotResponse(req: Request): Response {
  return jsonApiResponse(
    { error: MSG_BOT_BLOCKED },
    { status: HTTP_STATUS_FORBIDDEN },
    new URL(req.url),
  );
}

/** robots.txt: allow everyone, then disallow each blocked AI crawler. */
export function buildRobotsTxt(
  tokens: BotTokenLists = resolveBotTokenListsFromEnv(),
): string {
  const lines = [
    `${ROBOTS_USER_AGENT}: ${ROBOTS_WILDCARD}`,
    `${ROBOTS_ALLOW}: ${ROBOTS_ROOT}`,
  ];
  for (const agent of tokens.aiCrawlers) {
    lines.push(
      "",
      `${ROBOTS_USER_AGENT}: ${agent}`,
      `${ROBOTS_DISALLOW}: ${ROBOTS_ROOT}`,
    );
  }
  return `${lines.join(LINE_BREAK)}${LINE_BREAK}`;
}

export function robotsTxtResponse(req: Request): Response {
  const res = new Response(buildRobotsTxt(), {
    headers: { "Content-Type": MIME_TEXT_PLAIN_UTF8 },
  });
  return withSecurityHeadersFromRequest(res, req, "api");
}
