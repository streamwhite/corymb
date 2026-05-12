import { describe, expect, it } from "bun:test";
import {
  RESPONSE_FIELD_ACCESS_TOKEN,
  RESPONSE_FIELD_REFRESH_TOKEN,
} from "@/constants/auth.js";
import { MSG_REFRESH_TOKEN_INVALID } from "@/constants/messages.js";
import { AUTH_REFRESH_PATH } from "@/constants/routes.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "./constants.js";
import { createMemoryAppWithMailer } from "./helpers/app-memory-mail.js";
import { signupUser } from "./helpers/auth-flow.js";

const jsonHeaders = {
  [HEADER_CONTENT_TYPE]: MIME_JSON,
} as Record<string, string>;

async function postRefresh(
  request: (p: string, init?: RequestInit) => Promise<Response>,
  refreshToken: string,
): Promise<Response> {
  return request(AUTH_REFRESH_PATH, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ [RESPONSE_FIELD_REFRESH_TOKEN]: refreshToken }),
  });
}

describe("auth refresh", () => {
  it("rotates refresh+access; old refresh is rejected (rotation)", async () => {
    const { app } = await createMemoryAppWithMailer();
    const user = await signupUser(app.request, {
      email: "rotate@example.com",
      username: "rotate_user",
    });
    const first = await postRefresh(app.request, user.refreshToken);
    expect(first.status).toBe(200);
    const body = (await first.json()) as Record<string, unknown>;
    expect(typeof body[RESPONSE_FIELD_ACCESS_TOKEN]).toBe("string");
    expect(typeof body[RESPONSE_FIELD_REFRESH_TOKEN]).toBe("string");
    const reuse = await postRefresh(app.request, user.refreshToken);
    expect(reuse.status).toBe(401);
    const err = (await reuse.json()) as { error: string };
    expect(err.error).toBe(MSG_REFRESH_TOKEN_INVALID);
  });

  it("rejects refresh with invalid token", async () => {
    const { app } = await createMemoryAppWithMailer();
    const res = await postRefresh(app.request, "garbage");
    expect(res.status).toBe(401);
  });
});
