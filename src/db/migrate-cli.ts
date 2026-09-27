import { migrateDatabase } from "@/db/migrate.js";

async function main(): Promise<void> {
  await migrateDatabase();
  console.info("Database migrations applied.");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
