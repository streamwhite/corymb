import { describe, expect, it } from "bun:test";
import { createPostgrestClient } from "@/data/postgrest-client.js";

const ENV_TEST_POSTGREST_URL = "TEST_POSTGREST_URL" as const;

const url = process.env[ENV_TEST_POSTGREST_URL];

/**
 * Opt-in integration test against a real PostgREST instance. Configure
 * `TEST_POSTGREST_URL` (and `TEST_POSTGREST_TOKEN` for authenticated calls)
 * to run it; skipped otherwise so unit tests need no service.
 */
describe.skipIf(url === undefined)("postgrest integration", () => {
  it("reaches the PostgREST root", async () => {
    const client = createPostgrestClient({ url: url ?? "" });
    expect(await client.health()).toBe(true);
  });
});
