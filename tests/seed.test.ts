import { describe, expect, it } from "bun:test";
import { SEED_USER_COUNT } from "@/constants/seed.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { closeDbBundle, createDbBundle } from "@/db/client.js";
import { seedDatabase } from "@/db/seed.js";

function countFrom(rows: unknown, key: string): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  const row = rows[0] as Record<string, unknown>;
  const v = row[key];
  return typeof v === "bigint" ? Number(v) : Number(v);
}

describe("seed", () => {
  it("fills users table", async () => {
    const bundle = await createDbBundle({ databasePath: SQLITE_IN_MEMORY });
    try {
      await seedDatabase(bundle);
      const users = await bundle.sql`SELECT count(*) AS c FROM users`;
      expect(countFrom(users, "c")).toBe(SEED_USER_COUNT);
    } finally {
      await closeDbBundle(bundle);
    }
  });
});
