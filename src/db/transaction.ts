import type { SQL } from "bun";
import { APP_DB_SCHEMA } from "@/constants/database.js";

/** A transaction-scoped SQL handle (supports `savepoint`). */
export type TransactionClient = Bun.TransactionSQL;

/** A savepoint-scoped SQL handle. */
export type SavepointClient = Bun.SavepointSQL;

/**
 * Runs `fn` inside a single PostgreSQL transaction (BEGIN/COMMIT), rolling back
 * on any thrown error. The callback receives a transaction-scoped `SQL`.
 */
export async function withTransaction<T>(
  sql: SQL,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => fn(tx));
}

/** Runs `fn` inside a savepoint of an existing transaction. */
export async function withSavepoint<T>(
  tx: TransactionClient,
  fn: (sp: SavepointClient) => Promise<T>,
): Promise<T> {
  return tx.savepoint(async (sp) => fn(sp));
}

export { APP_DB_SCHEMA };
