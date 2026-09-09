import { afterEach, describe, expect, it } from "bun:test";
import { resolveDatabaseConfigFromEnv } from "@/constants/database.js";
import { resolveMigrationsFolder } from "@/db/migrations-path.js";
import { readMigrationFiles } from "@/db/read-migration-files.js";

const ENV_DATABASE_URL = "DATABASE_URL";

describe("database dialect resolution", () => {
  const original = process.env[ENV_DATABASE_URL];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_DATABASE_URL];
    } else {
      process.env[ENV_DATABASE_URL] = original;
    }
  });

  it("detects postgres URLs (postgres:// and postgresql://)", () => {
    const url = "postgres://user:pass@localhost:5432/app";
    process.env[ENV_DATABASE_URL] = url;
    expect(resolveDatabaseConfigFromEnv()).toEqual({
      dialect: "postgres",
      pgUrl: url,
    });
    process.env[ENV_DATABASE_URL] = "postgresql://localhost/app";
    expect(resolveDatabaseConfigFromEnv()).toEqual({
      dialect: "postgres",
      pgUrl: "postgresql://localhost/app",
    });
  });

  it("falls back to sqlite when DATABASE_URL is unset", () => {
    delete process.env[ENV_DATABASE_URL];
    const originalSqlitePath = process.env.SQLITE_PATH;
    delete process.env.SQLITE_PATH;
    try {
      expect(resolveDatabaseConfigFromEnv().dialect).toBe("sqlite");
    } finally {
      if (originalSqlitePath !== undefined) {
        process.env.SQLITE_PATH = originalSqlitePath;
      }
    }
  });

  it("exposes pg migrations with a valid journal", () => {
    const folder = resolveMigrationsFolder("postgres");
    const migrations = readMigrationFiles(folder);
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0]?.sql.length).toBeGreaterThan(0);
  });
});
