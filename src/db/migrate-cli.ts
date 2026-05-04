import { SQLITE_IN_MEMORY } from "@/constants/sqlite.js";
import { closeDbBundle, createDbBundle } from "@/db/client.js";
import { resolveSqlitePathFromEnv } from "@/db/resolve-sqlite-path.js";

async function main(): Promise<void> {
  if (resolveSqlitePathFromEnv() === SQLITE_IN_MEMORY) {
    console.error(
      "Refusing to migrate with SQLITE_PATH=:memory:. Set SQLITE_PATH to a file.",
    );
    process.exit(1);
  }
  const bundle = await createDbBundle();
  try {
    console.info("Database migrations applied.");
  } finally {
    await closeDbBundle(bundle);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
