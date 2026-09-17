import {
  classifyUserAgent,
  shouldBlockBot,
  type BotClassification,
} from "@/bot/bot-detection.js";
import { blockedBotResponse } from "@/bot/bot-response.js";
import {
  BOT_DETECTION_MODE_LOG,
  BOT_DETECTION_MODE_OFF,
  type BotDetectionMode,
  resolveBotDetectionModeFromEnv,
  resolveBotTokenListsFromEnv,
} from "@/constants/bot.js";
import { HEADER_USER_AGENT } from "@/constants/http-security.js";

export type BotRouteHandler = (
  req: Request,
) => Response | Promise<Response>;

let modeOverride: BotDetectionMode | undefined;

/** Test-only: force a bot-detection mode regardless of env. */
export function setBotDetectionModeForTests(
  mode: BotDetectionMode | undefined,
): void {
  modeOverride = mode;
}

function currentMode(): BotDetectionMode {
  return modeOverride ?? resolveBotDetectionModeFromEnv();
}

export function detectRequestBot(req: Request): BotClassification {
  return classifyUserAgent(
    req.headers.get(HEADER_USER_AGENT),
    resolveBotTokenListsFromEnv(),
  );
}

/** Returns a 403 response when the request should be blocked, else null. */
export function blockRequestIfBot(req: Request): Response | null {
  const mode = currentMode();
  if (mode === BOT_DETECTION_MODE_OFF) {
    return null;
  }
  const result = detectRequestBot(req);
  if (mode === BOT_DETECTION_MODE_LOG) {
    if (result.isBot) {
      console.info(`[bot] kind=${result.kind} ua=${req.headers.get(HEADER_USER_AGENT)}`);
    }
    return null;
  }
  return shouldBlockBot(result.kind, mode) ? blockedBotResponse(req) : null;
}

export function withBotDetection(handler: BotRouteHandler): BotRouteHandler {
  return (req: Request) => {
    const blocked = blockRequestIfBot(req);
    if (blocked !== null) {
      return blocked;
    }
    return handler(req);
  };
}
