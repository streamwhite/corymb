import {
  resolveDatabaseConfigFromEnv,
  SQLITE_IN_MEMORY,
} from "@/constants/database.js";
import { DB_SYNC_SEED_ON, ENV_DB_SYNC_SEED } from "@/constants/db-sync.js";
import { seedDatabase } from "@/db/seed.js";
import { createSeedRuntime } from "@/db/seed-runtime.js";

const ENV_NODE_ENV = "NODE_ENV" as const;
const NODE_ENV_PRODUCTION = "production" as const;

async function main(): Promise<void> {
  const config = resolveDatabaseConfigFromEnv();
  if (config.dialect === "sqlite" && config.sqlitePath === SQLITE_IN_MEMORY) {
    console.error(
      "Set SQLITE_PATH (or DATABASE_URL) to a persistent database for database sync.",
    );
    process.exit(1);
  }
  const runtime = await createSeedRuntime();
  try {
    console.info("Migrations applied.");
    const wantSeed = process.env[ENV_DB_SYNC_SEED] === DB_SYNC_SEED_ON;
    if (wantSeed && process.env[ENV_NODE_ENV] === NODE_ENV_PRODUCTION) {
      console.warn(
        "Seed skipped: DB_SYNC_SEED is not applied when NODE_ENV=production.",
      );
    } else if (wantSeed) {
      await seedDatabase(runtime.auth);
      console.info("Seed completed.");
    }
  } finally {
    await runtime.close();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
