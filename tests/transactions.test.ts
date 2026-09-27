import { describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { createUnitOfWork } from "@/db/unit-of-work.js";
import { withSavepoint, withTransaction } from "@/db/transaction.js";
import {
  createTestDatabase,
  dropTestDatabase,
  PG_AVAILABLE,
  queryPg,
} from "./helpers/test-db.js";

const TABLE = "app.tx_demo" as const;

async function createTable(sql: SQL): Promise<void> {
  await sql.unsafe(`create schema if not exists app`);
  await sql.unsafe(
    `create table if not exists ${TABLE} (id serial primary key, value text not null)`,
  );
  await sql.unsafe(`truncate ${TABLE}`);
}

describe.skipIf(!PG_AVAILABLE)("transactions", () => {
  it("commits all statements on success", async () => {
    const pgUrl = await createTestDatabase();
    const sql = new SQL(pgUrl);
    try {
      await createTable(sql);
      await withTransaction(sql, async (tx) => {
        await tx.unsafe(`insert into ${TABLE} (value) values ('a'), ('b')`);
      });
      const rows = await queryPg<{ c: number }>(
        pgUrl,
        `select count(*)::int as c from ${TABLE}`,
      );
      expect(rows[0]?.c).toBe(2);
    } finally {
      await sql.close();
      await dropTestDatabase(pgUrl);
    }
  });

  it("rolls back everything when the transaction throws", async () => {
    const pgUrl = await createTestDatabase();
    const sql = new SQL(pgUrl);
    try {
      await createTable(sql);
      await withTransaction(sql, async (tx) => {
        await tx.unsafe(`insert into ${TABLE} (value) values ('a')`);
        throw new Error("boom");
      }).catch(() => {});
      const rows = await queryPg<{ c: number }>(
        pgUrl,
        `select count(*)::int as c from ${TABLE}`,
      );
      expect(rows[0]?.c).toBe(0);
    } finally {
      await sql.close();
      await dropTestDatabase(pgUrl);
    }
  });

  it("supports savepoints to partially roll back", async () => {
    const pgUrl = await createTestDatabase();
    const sql = new SQL(pgUrl);
    try {
      await createTable(sql);
      await withTransaction(sql, async (tx) => {
        await tx.unsafe(`insert into ${TABLE} (value) values ('keep')`);
        await withSavepoint(tx, async (sp) => {
          await sp.unsafe(`insert into ${TABLE} (value) values ('drop')`);
          throw new Error("rollback sp");
        }).catch(() => {});
      });
      const rows = await queryPg<{ value: string }>(
        pgUrl,
        `select value from ${TABLE} order by value`,
      );
      expect(rows.map((r) => r.value)).toEqual(["keep"]);
    } finally {
      await sql.close();
      await dropTestDatabase(pgUrl);
    }
  });
});

describe.skipIf(!PG_AVAILABLE)("unit of work", () => {
  it("runs all registered steps atomically and returns the result", async () => {
    const pgUrl = await createTestDatabase();
    const sql = new SQL(pgUrl);
    try {
      await createTable(sql);
      const result = await createUnitOfWork(sql, (register) => {
        register((tx: SQL) =>
          tx.unsafe(`insert into ${TABLE} (value) values ('one')`),
        );
        register(
          (tx: SQL) => tx.unsafe(`insert into ${TABLE} (value) values ('two')`),
        );
        return { ok: true } as const;
      }).execute();
      expect(result).toEqual({ ok: true });
      const rows = await queryPg<{ c: number }>(
        pgUrl,
        `select count(*)::int as c from ${TABLE}`,
      );
      expect(rows[0]?.c).toBe(2);
    } finally {
      await sql.close();
      await dropTestDatabase(pgUrl);
    }
  });

  it("rolls back every step when one fails", async () => {
    const pgUrl = await createTestDatabase();
    const sql = new SQL(pgUrl);
    try {
      await createTable(sql);
      await createUnitOfWork(sql, (register) => {
        register((tx: SQL) =>
          tx.unsafe(`insert into ${TABLE} (value) values ('a')`),
        );
        register(() => {
          throw new Error("step failed");
        });
      })
        .execute()
        .catch(() => {});
      const rows = await queryPg<{ c: number }>(
        pgUrl,
        `select count(*)::int as c from ${TABLE}`,
      );
      expect(rows[0]?.c).toBe(0);
    } finally {
      await sql.close();
      await dropTestDatabase(pgUrl);
    }
  });
});
