import { describe, expect, it } from "bun:test";
import { openAuthDatabase } from "@/auth/auth-database.js";
import { scheduleTestDispose } from "./dispose-guard.js";
import {
  createTestDatabase,
  dropTestDatabase,
  PG_AVAILABLE,
} from "./helpers/test-db.js";

describe.skipIf(!PG_AVAILABLE)("openAuthDatabase", () => {
  it("opens a Postgres pool scoped to the auth schema", async () => {
    const pgUrl = await createTestDatabase();
    const bundle = openAuthDatabase({ pgUrl });
    scheduleTestDispose(async () => {
      await bundle.close();
      await dropTestDatabase(pgUrl);
    });
    const result = await bundle.database.query<{ current_schema: string }>(
      "SELECT current_schema() AS current_schema",
    );
    expect(result.rows[0]?.current_schema).toBe("auth");
  });
});
