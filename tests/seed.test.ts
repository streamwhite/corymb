import { describe, expect, it } from "bun:test";
import { SEED_USER_COUNT } from "@/constants/seed.js";
import { createSeedRuntime } from "@/db/seed-runtime.js";
import { seedDatabase } from "@/db/seed.js";
import {
  createTestDatabase,
  dropTestDatabase,
  PG_AVAILABLE,
  queryPg,
} from "./helpers/test-db.js";

describe.skipIf(!PG_AVAILABLE)("seed", () => {
  it("fills the auth user table", async () => {
    const pgUrl = await createTestDatabase();
    const runtime = await createSeedRuntime({
      useMemoryCache: true,
      databaseConfig: { pgUrl },
    });
    try {
      await seedDatabase(runtime.auth);
      const rows = await queryPg<{ c: number }>(
        pgUrl,
        'SELECT count(*)::int AS c FROM auth."user"',
      );
      expect(rows[0]?.c).toBe(SEED_USER_COUNT);
    } finally {
      await runtime.close();
      await dropTestDatabase(pgUrl);
    }
  });
});
