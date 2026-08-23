import { describe, expect, it } from "bun:test";
import { UI_AUTH_BASE_PATH } from "@/constants/routes.js";
import { AUTH_PAGE_HEADING } from "@/constants/ui.js";
import { createMemoryApp } from "./helpers/app-memory.js";

describe("auth ui", () => {
  it("serves the auth page", async () => {
    const { app } = await createMemoryApp();
    const res = await app.request(UI_AUTH_BASE_PATH);
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type");
    expect(ct).toContain("text/html");
    const html = await res.text();
    expect(html).toContain(AUTH_PAGE_HEADING);
    expect(html).toContain("signup-form");
    expect(html).toContain("su-username");
    expect(html).toContain("signin-form");
    expect(html).toContain('id="session-section"');
    expect(html).toContain("session-section");
    expect(html).toMatch(/id="session-section"[^>]*\bhidden\b/);
    expect(html).toContain("signout-btn");
    expect(html).toContain("get-session");
    expect(html).toContain('id="passkey-signin-btn"');
    expect(html).toContain('id="add-passkey-btn"');
    expect(html).toContain('id="passkey-list"');
    expect(html).toContain("generate-authenticate-options");
    expect(html).toContain("verify-authentication");
    expect(html).toContain("list-user-passkeys");
    expect(html).toContain("delete-passkey");
    expect(html).toContain('id="passkey-section"');
    expect(html).toMatch(/id="passkey-section"[^>]*\bhidden\b/);
  });
});
