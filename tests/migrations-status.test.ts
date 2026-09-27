import { describe, expect, it } from "bun:test";
import { SQL } from "bun";
import {
  migrationStatus,
  pendingMigrations,
} from "@/db/migrations-status.js";
import { createAdminDb, closeAdminDb } from "@/db/admin-client.js";
import {
  createTestDatabase,
  dropTestDatabase,
  PG_AVAILABLE,
} from "./helpers/test-db.js";

describe.skipIf(!PG_AVAILABLE)("migration status", () => {
  it("reports every migration as applied after migrate", async () => {
    const pgUrl = await createTestDatabase();
    const sql = new SQL(pgUrl);
    try {
      const status = await migrationStatus(sql);
      expect(status.length).toBeGreaterThan(0);
      expect(status.every((entry) => entry.applied)).toBe(true);
      expect(await pendingMigrations(sql)).toEqual([]);
      expect(status.map((s) => s.tag)).toContain("0002_two_factor");
    } finally {
      await sql.close();
      await dropTestDatabase(pgUrl);
    }
  });

  it("exposes status/transaction helpers on the admin db", async () => {
    const pgUrl = await createTestDatabase();
    const db = await createAdminDb({ databaseConfig: { pgUrl } });
    try {
      const status = await db.migrationStatus();
      expect(status.every((entry) => entry.applied)).toBe(true);
      const value = await db.transaction(async (tx) => {
        const rows = (await tx.unsafe("select 1 as n")) as Array<{ n: number }>;
        return rows[0]?.n;
      });
      expect(value).toBe(1);
    } finally {
      await closeAdminDb(db);
      await dropTestDatabase(pgUrl);
    }
  });
});
