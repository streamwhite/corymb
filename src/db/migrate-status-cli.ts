import { closeAdminDb, createAdminDb } from "@/db/admin-client.js";

async function main(): Promise<void> {
  const db = await createAdminDb();
  try {
    const status = await db.migrationStatus();
    for (const entry of status) {
      console.info(
        `${entry.applied ? "[applied]" : "[pending]"} ${entry.tag} (${String(entry.folderMillis)})`,
      );
    }
    const pending = status.filter((entry) => !entry.applied);
    if (pending.length > 0) {
      console.info(`${String(pending.length)} pending migration(s).`);
    } else {
      console.info("All migrations applied.");
    }
  } finally {
    await closeAdminDb(db);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
