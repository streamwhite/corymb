import {
  type AdminDbOptions,
  closeAdminDb,
  createAdminDb,
} from "@/db/admin-client.js";

/** Applies all pending SQL migrations, then releases the admin connection. */
export async function migrateDatabase(options?: AdminDbOptions): Promise<void> {
  const db = await createAdminDb(options);
  await closeAdminDb(db);
}
