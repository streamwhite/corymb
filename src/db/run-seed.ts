import { createDbBundle } from "@/db/client.js";
import { seedDatabase } from "@/db/seed.js";

const bundle = createDbBundle();
try {
  seedDatabase(bundle);
  console.info("Seed completed.");
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  bundle.sqlite.close();
}
