import { closeDbBundle, createDbBundle } from "@/db/client.js";
import { seedDatabase } from "@/db/seed.js";

async function main(): Promise<void> {
  const bundle = await createDbBundle();
  try {
    await seedDatabase(bundle);
    console.info("Seed completed.");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await closeDbBundle(bundle);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
