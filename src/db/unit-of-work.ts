import type { SQL } from "bun";
import type { PostgrestClient } from "@/data/postgrest-client.js";
import type { RpcArgs } from "@/data/postgrest-types.js";
import type { TransactionClient } from "@/db/transaction.js";

/**
 * Unit of Work over a single PostgreSQL transaction. Work is registered as
 * functions of the transaction handle; the unit runs them in order, atomically,
 * and rolls all of them back if any step throws.
 *
 * Use for privileged, multi-step server operations. For application data over
 * PostgREST, prefer a single database-function call via `runInTransaction`,
 * which is atomic server-side with no client-side transaction bookkeeping.
 */
export type UnitOfWork<T> = {
  /** Runs all registered work inside one transaction and returns the result. */
  execute: () => Promise<T>;
};

export type UnitOfWorkStep<Tx, R = void> = (tx: Tx) => Promise<R> | R;

export type RegisterStep = <R>(step: UnitOfWorkStep<TransactionClient, R>) => void;

/**
 * Creates a Unit of Work backed by the admin `SQL` connection. `work` receives a
 * `register` callback; registered steps run inside one `BEGIN`/`COMMIT` after
 * `work` returns, and the first failure rolls back the whole unit.
 */
export function createUnitOfWork<T>(
  sql: SQL,
  work: (register: RegisterStep) => T | Promise<T>,
): UnitOfWork<T> {
  return {
    async execute(): Promise<T> {
      return sql.begin(async (tx) => {
        const steps: Array<() => Promise<unknown>> = [];
        const register: RegisterStep = (step) => {
          steps.push(() => Promise.resolve(step(tx)));
        };
        const result = await work(register);
        for (const step of steps) {
          await step();
        }
        return result;
      });
    },
  };
}

/** Runs a database function atomically over PostgREST (single HTTP request). */
export async function runInTransaction<T>(
  client: PostgrestClient,
  fn: string,
  args?: RpcArgs,
): Promise<T> {
  const result = await client.rpc<T>(fn, args);
  return result.data;
}
