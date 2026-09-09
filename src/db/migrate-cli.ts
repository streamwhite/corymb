import { resolveDatabaseConfigFromEnv } from "@/constants/database.js";
import { closeDbBundle, createDbBundle } from "@/db/client.js";

async function main(): Promise<void> {
  const config = resolveDatabaseConfigFromEnv();
  if (config.dialect === "sqlite" && config.sqlitePath === ":memory:") {
    console.error(
      "Refusing to migrate an in-memory database. Set SQLITE_PATH or DATABASE_URL to a persistent target.",
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
