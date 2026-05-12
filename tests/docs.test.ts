import { describe, expect, it } from "bun:test";
import {
  DOCS_CURL_ICON_DONE_CLASS,
  DOCS_CURL_ICON_IDLE_CLASS,
  DOCS_GROUP_AUTH,
  DOCS_GROUP_HEADING_CLASS,
  DOCS_GROUP_UPLOAD,
} from "@/constants/api-docs.js";
import {
  DOCS_ACCESS_MODE_DEVELOPMENT,
  DOCS_ACCESS_MODE_PRODUCTION,
} from "@/constants/docs-access.js";
import { MSG_HTTP_NOT_FOUND } from "@/constants/messages.js";
import {
  AUTH_SIGNIN_PATH,
  AUTH_SIGNUP_PATH,
  DOCS_BASE_PATH,
  HEALTH_BASE_PATH,
  UPLOAD_BASE_PATH,
} from "@/constants/routes.js";
import { createMemoryApp } from "./helpers/app-memory.js";

describe("docs", () => {
  it("returns HTML with curl examples when docs access is development", async () => {
    const { app } = await createMemoryApp({
      docsAccess: DOCS_ACCESS_MODE_DEVELOPMENT,
    });
    const res = await app.request(DOCS_BASE_PATH);
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("<!DOCTYPE html>");
    expect(body).toContain(`class="${DOCS_CURL_ICON_IDLE_CLASS}"`);
    expect(body).toContain(`class="${DOCS_CURL_ICON_DONE_CLASS}"`);
    expect(body).toContain(DOCS_GROUP_AUTH);
    expect(body).toContain(DOCS_GROUP_UPLOAD);
    expect(body).toContain(`class="${DOCS_GROUP_HEADING_CLASS}"`);
    expect(body).toContain("curl");
    expect(body).toContain(HEALTH_BASE_PATH);
    expect(body).toContain(AUTH_SIGNUP_PATH);
    expect(body).toContain(AUTH_SIGNIN_PATH);
    expect(body).toContain(UPLOAD_BASE_PATH);
  });

  it("returns 404 when docs access is production (NODE_ENV-safe)", async () => {
    const { app } = await createMemoryApp({
      docsAccess: DOCS_ACCESS_MODE_PRODUCTION,
    });
    const res = await app.request(DOCS_BASE_PATH);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(MSG_HTTP_NOT_FOUND);
  });
});
