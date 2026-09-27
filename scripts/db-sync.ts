import { DB_SYNC_SEED_ON, ENV_DB_SYNC_SEED } from "@/constants/db-sync.js";
import { migrateDatabase } from "@/db/migrate.js";
import { createSeedRuntime } from "@/db/seed-runtime.js";
import { seedDatabase } from "@/db/seed.js";

const ENV_NODE_ENV = "NODE_ENV" as const;
const NODE_ENV_PRODUCTION = "production" as const;

async function maybeSeed(): Promise<void> {
  const wantSeed = process.env[ENV_DB_SYNC_SEED] === DB_SYNC_SEED_ON;
  if (!wantSeed) {
    return;
  }
  if (process.env[ENV_NODE_ENV] === NODE_ENV_PRODUCTION) {
    console.warn(
      "Seed skipped: DB_SYNC_SEED is not applied when NODE_ENV=production.",
    );
    return;
  }
  const runtime = await createSeedRuntime();
  try {
    await seedDatabase(runtime.auth);
    console.info("Seed completed.");
  } finally {
    await runtime.close();
  }
}

async function main(): Promise<void> {
  await migrateDatabase();
  console.info("Migrations applied.");
  await maybeSeed();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
