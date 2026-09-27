import { Pool } from "pg";
import {
  AUTH_DB_SCHEMA,
  buildSchemaConnectionUrl,
  type DatabaseConfig,
} from "@/constants/database.js";

/**
 * Better Auth persistence driver. Auth tables live in the dedicated `auth`
 * schema (explicit auth exception; see docs/adr/0001-postgrest-auth-exception.md).
 * Application data is served through PostgREST instead.
 */
export type AuthDatabaseDriver = Pool;

export type AuthDatabaseBundle = {
  database: AuthDatabaseDriver;
  close: () => Promise<void>;
};

export function openAuthDatabase(config: DatabaseConfig): AuthDatabaseBundle {
  const pool = new Pool({
    connectionString: buildSchemaConnectionUrl(config.pgUrl, AUTH_DB_SCHEMA),
  });
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
