import { Hono } from "hono";
import { HEALTH_OK_BODY } from "@/constants/health.js";
import { HEALTH_BASE_PATH } from "@/constants/routes.js";

export function createHealthRouter() {
  const r = new Hono();
  r.get(HEALTH_BASE_PATH, (c) => c.json(HEALTH_OK_BODY));
  return r;
}
