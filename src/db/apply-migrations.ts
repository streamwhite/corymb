import type { SQL } from "bun";
import { readMigrationFiles } from "@/db/read-migration-files.js";

const MIGRATIONS_TABLE = "__drizzle_migrations" as const;

const CREATE_MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
)
`;

export type LastMigrationRow = {
  id: number;
  hash: string;
  created_at: number;
};

function pickLastMigrationRow(
  rows: LastMigrationRow[] | unknown,
): LastMigrationRow | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  return rows[0] as LastMigrationRow;
}

function shouldApplyMigration(
  last: LastMigrationRow | undefined,
  folderMillis: number,
): boolean {
  return last === undefined || Number(last.created_at) < folderMillis;
}

async function applyOne(
  tx: SQL,
  statements: string[],
  hash: string,
  folderMillis: number,
): Promise<void> {
  for (const stmt of statements) {
    if (stmt.length > 0) {
      await tx.unsafe(stmt);
    }
  }
  await tx`
    INSERT INTO __drizzle_migrations ("hash", "created_at")
    VALUES (${hash}, ${folderMillis})
  `;
}

export async function applyMigrations(
  sql: SQL,
  migrationsFolder: string,
): Promise<void> {
  const migrations = readMigrationFiles(migrationsFolder);
  await sql.unsafe(CREATE_MIGRATIONS_TABLE_SQL);
  const dbMigrations = await sql.unsafe(
    `SELECT id, hash, created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`,
  );
  const lastDbMigration = pickLastMigrationRow(
    dbMigrations as LastMigrationRow[],
  );
  await sql.begin(async (tx) => {
    for (const migration of migrations) {
      if (!shouldApplyMigration(lastDbMigration, migration.folderMillis)) {
        continue;
      }
      await applyOne(
        tx,
        migration.sql,
        migration.hash,
        migration.folderMillis,
      );
    }
  });
}
