import { describe, expect, it } from "bun:test";
import { openAuthDatabase } from "@/auth/auth-database.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";

describe("openAuthDatabase", () => {
  it("opens an in-memory sqlite auth database", async () => {
    const bundle = openAuthDatabase({
      dialect: "sqlite",
      sqlitePath: SQLITE_IN_MEMORY,
    });
    expect(bundle.database).toBeDefined();
    await bundle.close();
  });

  it("rejects postgres without a connection URL", () => {
    expect(() => openAuthDatabase({ dialect: "postgres" })).toThrow();
  });
});
