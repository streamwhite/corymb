import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "@/constants/auth.js";
import {
  SEED_FAKER_SEED,
  SEED_ITEM_COUNT,
  SEED_USER_COUNT,
  SEED_USER_PASSWORD,
} from "@/constants/seed.js";
import type { DbBundle } from "@/db/client.js";
import { items, users } from "@/db/schema.js";

function truncateAll(bundle: DbBundle): void {
  bundle.sqlite.exec(`
DELETE FROM sessions;
DELETE FROM users;
DELETE FROM items;
`);
}

function buildUserRows(passwordHash: string) {
  return Array.from({ length: SEED_USER_COUNT }, (_, index) => ({
    id: randomUUID(),
    email: `seed-${String(index)}-${faker.internet.username()}@example.test`,
    passwordHash,
  }));
}

function buildItemRows() {
  return Array.from({ length: SEED_ITEM_COUNT }, () => ({
    id: randomUUID(),
    title: faker.commerce.productName(),
  }));
}

export function seedDatabase(bundle: DbBundle): void {
  faker.seed(SEED_FAKER_SEED);
  const passwordHash = bcrypt.hashSync(SEED_USER_PASSWORD, BCRYPT_COST);
  const userRows = buildUserRows(passwordHash);
  const itemRows = buildItemRows();
  truncateAll(bundle);
  bundle.db.transaction((tx) => {
    for (const row of userRows) {
      tx.insert(users).values(row).run();
    }
    for (const row of itemRows) {
      tx.insert(items).values(row).run();
    }
  });
}
