import { faker } from "@faker-js/faker";
import type { BetterAuthInstance } from "@/auth/better-auth.js";
import {
  SEED_FAKER_SEED,
  SEED_USER_COUNT,
  SEED_USER_PASSWORD,
} from "@/constants/seed.js";

function buildUserRows() {
  return Array.from({ length: SEED_USER_COUNT }, (_, index) => {
    const username =
      `seeduser_${String(index)}_${faker.string.alphanumeric(8).toLowerCase()}`;
    return {
      email: `seed-${String(index)}-${faker.internet.username()}@example.test`,
      username,
      name: username,
      password: SEED_USER_PASSWORD,
    };
  });
}

export async function seedDatabase(auth: BetterAuthInstance): Promise<void> {
  faker.seed(SEED_FAKER_SEED);
  const userRows = buildUserRows();
  for (const row of userRows) {
    await auth.api.signUpEmail({
      body: {
        email: row.email,
        password: row.password,
        name: row.name,
        username: row.username,
      },
    });
  }
}
