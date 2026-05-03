import { describe, expect, it } from "bun:test";
import { UI_AUTH_BASE_PATH } from "@/constants/routes.js";
import { AUTH_PAGE_HEADING } from "@/constants/ui.js";
import { createMemoryApp } from "./helpers/app-memory.js";

describe("auth ui", () => {
  it("serves the auth page", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(UI_AUTH_BASE_PATH);
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type");
    expect(ct).toContain("text/html");
    const html = await res.text();
    expect(html).toContain(AUTH_PAGE_HEADING);
    expect(html).toContain("signup-form");
    expect(html).toContain("su-username");
    expect(html).toContain("signin-form");
  });
});
