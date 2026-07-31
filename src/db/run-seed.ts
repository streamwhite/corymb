import { createSeedRuntime } from "@/db/seed-runtime.js";
import { seedDatabase } from "@/db/seed.js";

async function main(): Promise<void> {
  const runtime = await createSeedRuntime();
  try {
    await seedDatabase(runtime.auth);
    console.info("Seed completed.");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await runtime.close();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
