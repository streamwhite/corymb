import { DB_SYNC_SEED_ON, ENV_DB_SYNC_SEED } from "@/constants/db-sync.js";
import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { closeDbBundle, createDbBundle } from "@/db/client.js";
import { resolveSqlitePathFromEnv } from "@/db/resolve-sqlite-path.js";
import { seedDatabase } from "@/db/seed.js";

const ENV_NODE_ENV = "NODE_ENV" as const;
const NODE_ENV_PRODUCTION = "production" as const;

async function main(): Promise<void> {
  if (resolveSqlitePathFromEnv() === SQLITE_IN_MEMORY) {
    console.error(
      "Set SQLITE_PATH to a database file (not :memory:) for database sync.",
    );
    process.exit(1);
  }
  const bundle = await createDbBundle();
  try {
    console.info("Migrations applied.");
    const wantSeed = process.env[ENV_DB_SYNC_SEED] === DB_SYNC_SEED_ON;
    if (wantSeed && process.env[ENV_NODE_ENV] === NODE_ENV_PRODUCTION) {
      console.warn(
        "Seed skipped: DB_SYNC_SEED is not applied when NODE_ENV=production.",
      );
    } else if (wantSeed) {
      await seedDatabase(bundle);
      console.info("Seed completed.");
    }
  } finally {
    await closeDbBundle(bundle);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
