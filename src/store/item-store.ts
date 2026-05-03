import { asc, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "@/db/schema.js";
import { items } from "@/db/schema.js";
import { syncToPromise } from "@/lib/sync-to-promise.js";
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

export function createItemStore(
  db: BunSQLiteDatabase<typeof schema>,
): ItemStore {
  return {
    list() {
      return syncToPromise(() => {
        return db
          .select()
          .from(items)
          .orderBy(asc(items.createdAt))
          .all() as Item[];
      });
    },
    create(input: CreateItemInput) {
      return syncToPromise(() => {
        const id = crypto.randomUUID();
        const [row] = db
          .insert(items)
          .values({ id, title: input.title })
          .returning()
          .all();
        if (row === undefined) {
          throw new Error("Insert item returned no row");
        }
        return row as Item;
      });
    },
    getById(id: ItemId) {
      return syncToPromise(() => {
        const row = db.select().from(items).where(eq(items.id, id)).get();
        return row === undefined ? undefined : (row as Item);
      });
    },
    update(id: ItemId, input: UpdateItemInput) {
      return syncToPromise(() => {
        const existing = db.select().from(items).where(eq(items.id, id)).get();
        if (existing === undefined) {
          return undefined;
        }
        const nextTitle =
          input.title !== undefined ? input.title : existing.title;
        db.update(items)
          .set({ title: nextTitle })
          .where(eq(items.id, id))
          .run();
        return {
          id: existing.id,
          title: nextTitle,
          createdAt: existing.createdAt,
        };
      });
    },
    delete(id: ItemId) {
      return syncToPromise(() => {
        const rows = db
          .delete(items)
          .where(eq(items.id, id))
          .returning({ id: items.id })
          .all();
        return rows.length > 0;
      });
    },
  };
}
