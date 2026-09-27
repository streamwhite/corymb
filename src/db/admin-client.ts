import { SQL } from "bun";
import {
  type DatabaseConfig,
  resolveDatabaseConfigFromEnv,
} from "@/constants/database.js";
import { applyMigrations } from "@/db/apply-migrations.js";
import { resolveMigrationsFolder } from "@/db/migrations-path.js";
import {
  migrationStatus,
  type MigrationStatusEntry,
} from "@/db/migrations-status.js";

/**
 * Administrative PostgreSQL connection used for schema migrations, transactions
 * and operational tasks. Application runtime data goes through PostgREST.
 */
export type AdminDb = {
  sql: SQL;
  pgUrl: string;
  /** Runs `fn` inside one transaction (BEGIN/COMMIT, rollback on throw). */
  transaction: <T>(fn: (tx: SQL) => Promise<T>) => Promise<T>;
  /** Lists migrations with their applied state. */
  migrationStatus: () => Promise<MigrationStatusEntry[]>;
};

export type AdminDbOptions = {
  databaseConfig?: DatabaseConfig;
};

export async function createAdminDb(
  options?: AdminDbOptions,
): Promise<AdminDb> {
  const config = options?.databaseConfig ?? resolveDatabaseConfigFromEnv();
  const sql = new SQL(config.pgUrl);
  try {
    await applyMigrations(sql, resolveMigrationsFolder());
  } catch (err) {
    await sql.close().catch(() => {});
    throw err;
  }
  return {
    sql,
    pgUrl: config.pgUrl,
    transaction: (fn) => sql.begin(async (tx) => fn(tx)),
    migrationStatus: () => migrationStatus(sql),
  };
}

export async function closeAdminDb(db: AdminDb): Promise<void> {
  await db.sql.close();
}
