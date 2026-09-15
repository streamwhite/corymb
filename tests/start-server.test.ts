import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createMemoryCache } from "@/cache/memory-cache.js";
import { HEALTH_BASE_PATH } from "@/constants/routes.js";
import { startServer } from "@/server/start-server.js";

const TEST_AUTH_SECRET = "test-better-auth-secret-at-least-32-chars!!";

describe("startServer (library entry)", () => {
  it("boots a real server and answers on /health", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ba-start-server-"));
    const { server, app, url } = await startServer({
      databasePath: join(dir, "test.sqlite"),
      cache: createMemoryCache(),
      authSecret: TEST_AUTH_SECRET,
      authBaseURL: "http://127.0.0.1",
      authTrustedOrigins: ["http://127.0.0.1", "http://localhost"],
      events: { publish: async () => {}, subscribe: async () => async () => {}, close: async () => {} },
      port: 0,
      hostname: "127.0.0.1",
    });
    try {
      const res = await fetch(new URL(HEALTH_BASE_PATH, url.href));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok" });
    } finally {
      await server.stop(true);
      await app.close();
    }
  });
});
