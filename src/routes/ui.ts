import { Hono } from "hono";
import { UI_AUTH_BASE_PATH } from "@/constants/routes.js";
import { buildAuthPageHtml } from "@/ui/auth-page-html.js";

export function createUiRouter() {
  const r = new Hono();
  r.get(UI_AUTH_BASE_PATH, (c) => c.html(buildAuthPageHtml()));
  return r;
}
