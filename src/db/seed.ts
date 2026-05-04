import { faker } from "@faker-js/faker";
import type { SQL } from "bun";
import { BCRYPT_COST } from "@/constants/auth.js";
import { bcryptHashOptions } from "@/constants/password-hash.js";
import {
  SEED_FAKER_SEED,
  SEED_ITEM_COUNT,
  SEED_USER_COUNT,
  SEED_USER_PASSWORD,
} from "@/constants/seed.js";
import type { DbBundle } from "@/db/client.js";

async function truncateAll(sql: SQL): Promise<void> {
  await sql.unsafe("DELETE FROM sessions;");
  await sql.unsafe("DELETE FROM users;");
  await sql.unsafe("DELETE FROM items;");
}

function buildUserRows(passwordHash: string) {
  return Array.from({ length: SEED_USER_COUNT }, (_, index) => ({
    id: crypto.randomUUID(),
    email: `seed-${String(index)}-${faker.internet.username()}@example.test`,
    username: `seeduser_${String(index)}_${faker.string.alphanumeric(8).toLowerCase()}`,
    passwordHash,
  }));
}

function buildItemRows() {
  return Array.from({ length: SEED_ITEM_COUNT }, () => ({
    id: crypto.randomUUID(),
    title: faker.commerce.productName(),
  }));
}

export async function seedDatabase(bundle: DbBundle): Promise<void> {
  faker.seed(SEED_FAKER_SEED);
  const passwordHash = Bun.password.hashSync(
    SEED_USER_PASSWORD,
    bcryptHashOptions(BCRYPT_COST),
  );
  const userRows = buildUserRows(passwordHash);
  const itemRows = buildItemRows();
  const { sql } = bundle;
  await truncateAll(sql);
  await sql.begin(async (tx) => {
    for (const row of userRows) {
      await tx`
        INSERT INTO users (id, email, username, password_hash)
        VALUES (${row.id}, ${row.email}, ${row.username}, ${row.passwordHash})
      `;
    }
    for (const row of itemRows) {
      await tx`
        INSERT INTO items (id, title)
        VALUES (${row.id}, ${row.title})
      `;
    }
  });
}
