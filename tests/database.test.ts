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
});
