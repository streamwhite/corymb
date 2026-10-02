import { afterEach, describe, expect, it } from "bun:test";
import {
  APP_DB_SCHEMA,
  AUTH_DB_SCHEMA,
  buildSchemaConnectionUrl,
  ENV_DATABASE_URL,
  isPostgresUrl,
  resolveDatabaseConfigFromEnv,
  resolvePgUrlFromEnv,
} from "@/constants/database.js";
import { resolveMigrationsFolder } from "@/db/migrations-path.js";
import { readMigrationFiles } from "@/db/read-migration-files.js";
import {
  PG_AVAILABLE,
  createTestDatabase,
  dropTestDatabase,
  queryPg,
} from "./helpers/test-db.js";

describe("database configuration", () => {
  const original = process.env[ENV_DATABASE_URL];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_DATABASE_URL];
    } else {
      process.env[ENV_DATABASE_URL] = original;
    }
  });

  it("accepts postgres:// and postgresql:// URLs", () => {
    expect(isPostgresUrl("postgres://user:pass@localhost:5432/app")).toBe(true);
    expect(isPostgresUrl("postgresql://localhost/app")).toBe(true);
    expect(isPostgresUrl("mysql://localhost/app")).toBe(false);
  });

  it("resolves a Postgres URL from the environment", () => {
    process.env[ENV_DATABASE_URL] = "postgres://localhost/app";
    expect(resolveDatabaseConfigFromEnv()).toEqual({
      pgUrl: "postgres://localhost/app",
    });
  });

  it("throws when DATABASE_URL is missing or not Postgres", () => {
    delete process.env[ENV_DATABASE_URL];
    expect(() => resolvePgUrlFromEnv()).toThrow();
    expect(() =>
      resolveDatabaseConfigFromEnv({ DATABASE_URL: "file:./data.sqlite" }),
    ).toThrow();
  });

  it("builds a connection URL with a schema search_path", () => {
    const url = buildSchemaConnectionUrl(
      "postgres://localhost/app",
      AUTH_DB_SCHEMA,
    );
    expect(new URL(url).searchParams.get("options")).toBe(
      `-c search_path=${AUTH_DB_SCHEMA}`,
    );
  });

  it("ships a migratable journal with schemas for auth and app", () => {
    const migrations = readMigrationFiles(resolveMigrationsFolder());
    expect(migrations.length).toBeGreaterThan(0);
    const allSql = migrations.flatMap((m) => m.sql).join("\n");
    expect(allSql).toContain(`schema if not exists ${AUTH_DB_SCHEMA}`);
    expect(allSql).toContain(`schema if not exists ${APP_DB_SCHEMA}`);
  });

  it("ships the pg_trgm extension for fuzzy search", () => {
    const migrations = readMigrationFiles(resolveMigrationsFolder());
    const allSql = migrations.flatMap((m) => m.sql).join("\n");
    expect(allSql).toContain("extension if not exists pg_trgm");
  });
});

describe.skipIf(!PG_AVAILABLE)("fuzzy search capability", () => {
  it("installs pg_trgm and computes trigram similarity after migrate", async () => {
    const pgUrl = await createTestDatabase();
    try {
      const extensions = await queryPg<{ extname: string }>(
        pgUrl,
        "select extname from pg_extension where extname = 'pg_trgm'",
      );
      expect(extensions.map((row) => row.extname)).toContain("pg_trgm");

      const [row] = await queryPg<{ sim: number }>(
        pgUrl,
        "select similarity('reac', 'react')::float8 as sim",
      );
      expect(row?.sim).toBeGreaterThan(0.5);
    } finally {
      await dropTestDatabase(pgUrl);
    }
  });

  it("installs unaccent and the search text configuration after migrate", async () => {
    const pgUrl = await createTestDatabase();
    try {
      const extensions = await queryPg<{ extname: string }>(
        pgUrl,
        "select extname from pg_extension where extname = 'unaccent'",
      );
      expect(extensions.map((row) => row.extname)).toContain("unaccent");

      // The immutable wrapper normalizes accents for generated columns/indexes.
      const [norm] = await queryPg<{ n: string }>(
        pgUrl,
        "select app.immutable_unaccent('réact') as n",
      );
      expect(norm?.n).toBe("react");

      const [cfg] = await queryPg<{ present: boolean }>(
        pgUrl,
        `select exists (
           select 1 from pg_ts_config c
           join pg_namespace ns on ns.oid = c.cfgnamespace
           where c.cfgname = 'unaccent_english' and ns.nspname = 'app'
         ) as present`,
      );
      expect(cfg?.present).toBe(true);
    } finally {
      await dropTestDatabase(pgUrl);
    }
  });
});
