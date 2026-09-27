import type { SQL } from "bun";
import { resolveMigrationsFolder } from "@/db/migrations-path.js";
import { readMigrationFiles } from "@/db/read-migration-files.js";

const MIGRATIONS_TABLE = "__drizzle_migrations" as const;

export type MigrationStatusEntry = {
  tag: string;
  folderMillis: number;
  applied: boolean;
};

async function appliedMillis(sql: SQL): Promise<Set<number>> {
  await sql.unsafe(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  );
  const rows = (await sql.unsafe(
    `SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at ASC`,
  )) as Array<{ created_at: number | string }>;
  return new Set(rows.map((row) => Number(row.created_at)));
}

/** Lists migrations in journal order with their applied state. */
export async function migrationStatus(
  sql: SQL,
  migrationsFolder: string = resolveMigrationsFolder(),
): Promise<MigrationStatusEntry[]> {
  const migrations = readMigrationFiles(migrationsFolder);
  const applied = await appliedMillis(sql);
  return migrations.map((migration) => ({
    tag: migration.tag,
    folderMillis: migration.folderMillis,
    applied: applied.has(migration.folderMillis),
  }));
}

/** Tags of migrations that have not been applied yet, in order. */
export async function pendingMigrations(
  sql: SQL,
  migrationsFolder: string = resolveMigrationsFolder(),
): Promise<string[]> {
  const status = await migrationStatus(sql, migrationsFolder);
  return status.filter((entry) => !entry.applied).map((entry) => entry.tag);
}
