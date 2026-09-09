import { Database } from "bun:sqlite";
import { Pool } from "pg";
import type { DatabaseConfig } from "@/constants/database.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";

export type AuthDatabaseDriver = Database | Pool;

export type AuthDatabaseBundle = {
  database: AuthDatabaseDriver;
  close: () => Promise<void>;
};

export function openAuthSqlite(databasePath: string): AuthDatabaseBundle {
  const database = new Database(databasePath, { create: true });
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  return {
    database,
    close: async () => {
      database.close();
    },
  };
}

export function openAuthPostgres(pgUrl: string): AuthDatabaseBundle {
  const pool = new Pool({ connectionString: pgUrl });
  pool.on("error", (err) => {
    console.error("Postgres pool error (auth):", err);
  });
  return {
    database: pool,
    close: async () => {
      await pool.end();
    },
  };
}

export function openAuthDatabase(config: DatabaseConfig): AuthDatabaseBundle {
  if (config.dialect === "postgres") {
    if (config.pgUrl === undefined) {
      throw new Error("Postgres dialect requires a connection URL");
    }
    return openAuthPostgres(config.pgUrl);
  }
  return openAuthSqlite(config.sqlitePath ?? SQLITE_IN_MEMORY);
}

export function openAuthDatabase(config: DatabaseConfig): AuthDatabaseBundle {
  if (config.dialect === "postgres") {
    if (config.pgUrl === undefined) {
      throw new Error("Postgres dialect requires a connection URL");
    }
    return openAuthPostgres(config.pgUrl);
  }
  return openAuthSqlite(config.sqlitePath ?? SQLITE_IN_MEMORY);
}
