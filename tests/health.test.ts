import { describe, expect, it } from "bun:test";
import { HEALTH_OK_BODY } from "@/constants/health.js";
import { HEALTH_BASE_PATH } from "@/constants/routes.js";
import { createMemoryApp } from "./helpers/app-memory.js";

describe("health", () => {
  it("returns 200 and status ok", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(HEALTH_BASE_PATH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual(HEALTH_OK_BODY);
  });
});
