import type { SQL } from "bun";
import type {
  CreateItemInput,
  Item,
  ItemId,
  UpdateItemInput,
} from "@/types/item.js";

export type ItemStore = {
  list: () => Promise<Item[]>;
  create: (input: CreateItemInput) => Promise<Item>;
  getById: (id: ItemId) => Promise<Item | undefined>;
  update: (id: ItemId, input: UpdateItemInput) => Promise<Item | undefined>;
  delete: (id: ItemId) => Promise<boolean>;
};

function firstItemRow(rows: unknown): Item | undefined {
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  return rows[0] as Item;
}

export function createItemStore(sql: SQL): ItemStore {
  return {
    async list() {
      const rows = await sql`
        SELECT id, title, created_at AS createdAt
        FROM items
        ORDER BY created_at
      `;
      return rows as unknown as Item[];
    },
    async create(input: CreateItemInput) {
      const id = crypto.randomUUID();
      const rows = await sql`
        INSERT INTO items (id, title)
        VALUES (${id}, ${input.title})
        RETURNING id, title, created_at AS createdAt
      `;
      const row = firstItemRow(rows);
      if (row === undefined) {
        throw new Error("Insert item returned no row");
      }
      return row;
    },
    async getById(id: ItemId) {
      const rows = await sql`
        SELECT id, title, created_at AS createdAt
        FROM items
        WHERE id = ${id}
      `;
      return firstItemRow(rows);
    },
    async update(id: ItemId, input: UpdateItemInput) {
      const existing = await this.getById(id);
      if (existing === undefined) {
        return undefined;
      }
      const nextTitle =
        input.title !== undefined ? input.title : existing.title;
      await sql`
        UPDATE items SET title = ${nextTitle} WHERE id = ${id}
      `;
      return { ...existing, title: nextTitle };
    },
    async delete(id: ItemId) {
      const rows = await sql`
        DELETE FROM items WHERE id = ${id} RETURNING id
      `;
      return Array.isArray(rows) && rows.length > 0;
    },
  };
}
