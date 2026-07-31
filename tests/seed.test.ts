import { describe, expect, it } from "bun:test";
import { SEED_USER_COUNT } from "@/constants/seed.js";
import { createSeedRuntime } from "@/db/seed-runtime.js";
import { seedDatabase } from "@/db/seed.js";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

function countFrom(rows: unknown, key: string): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  const row = rows[0] as Record<string, unknown>;
  const v = row[key];
  return typeof v === "bigint" ? Number(v) : Number(v);
}

describe("seed", () => {
  it("fills user table", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ba-seed-"));
    const databasePath = join(dir, "seed.sqlite");
    const runtime = await createSeedRuntime({
      databasePath,
      useMemoryCache: true,
    });
    try {
      await seedDatabase(runtime.auth);
      const users = await runtime.bundle.sql`SELECT count(*) AS c FROM user`;
      expect(countFrom(users, "c")).toBe(SEED_USER_COUNT);
    } finally {
      await runtime.close();
    }
  });
});
