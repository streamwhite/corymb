import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { HEALTH_OK_BODY } from "@/constants/health.js";
import { HEALTH_BASE_PATH } from "@/constants/routes.js";

describe("health", () => {
  it("returns 200 and status ok", async () => {
    const { app } = createApp();
    const res = await app.request(HEALTH_BASE_PATH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual(HEALTH_OK_BODY);
  });
});
