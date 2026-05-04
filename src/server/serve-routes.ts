import type { Serve, SQL } from "bun";
import { HEALTH_OK_BODY } from "@/constants/health.js";
import {
  AUTH_SIGNIN_PATH,
  AUTH_SIGNOUT_PATH,
  AUTH_SIGNUP_PATH,
  HEALTH_BASE_PATH,
  UI_AUTH_BASE_PATH,
} from "@/constants/routes.js";
import {
  handleAuthSignin,
  handleAuthSignout,
  handleAuthSignup,
} from "@/server/auth-route-handlers.js";
import { buildAuthPageHtml } from "@/ui/auth-page-html.js";

const MIME_HTML_UTF8 = "text/html; charset=utf-8" as const;

export type RouteBundle = {
  sql: SQL;
};

export function buildServeRoutes(
  bundle: RouteBundle,
): NonNullable<Serve["routes"]> {
  const { sql } = bundle;
  return {
    [HEALTH_BASE_PATH]: { GET: () => Response.json(HEALTH_OK_BODY) },
    [UI_AUTH_BASE_PATH]: {
      GET: () =>
        new Response(buildAuthPageHtml(), {
          headers: { "Content-Type": MIME_HTML_UTF8 },
        }),
    },
    [AUTH_SIGNUP_PATH]: {
      POST: (req: Request) => handleAuthSignup(req, sql),
    },
    [AUTH_SIGNIN_PATH]: {
      POST: (req: Request) => handleAuthSignin(req, sql),
    },
    [AUTH_SIGNOUT_PATH]: {
      POST: (req: Request) => handleAuthSignout(req, sql),
    },
  };
}
