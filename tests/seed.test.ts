import { describe, expect, it } from "vitest";
import { SEED_ITEM_COUNT, SEED_USER_COUNT } from "@/constants/seed.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { createDbBundle } from "@/db/client.js";
import { items, users } from "@/db/schema.js";
import { seedDatabase } from "@/db/seed.js";

describe("seed", () => {
  it("fills users and items tables", () => {
    const bundle = createDbBundle({ databasePath: SQLITE_IN_MEMORY });
    try {
      seedDatabase(bundle);
      expect(bundle.db.select().from(users).all().length).toBe(SEED_USER_COUNT);
      expect(bundle.db.select().from(items).all().length).toBe(SEED_ITEM_COUNT);
    } finally {
      bundle.sqlite.close();
    }
  });
});
