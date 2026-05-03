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

export function createItemStore(): ItemStore {
  const items = new Map<ItemId, Item>();

  return {
    list() {
      return Promise.resolve([...items.values()]);
    },
    create(input: CreateItemInput) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const item: Item = { id, title: input.title, createdAt };
      items.set(id, item);
      return Promise.resolve(item);
    },
    getById(id: ItemId) {
      return Promise.resolve(items.get(id));
    },
    update(id: ItemId, input: UpdateItemInput) {
      const existing = items.get(id);
      if (!existing) return Promise.resolve(undefined);
      const next: Item = {
        ...existing,
        ...(input.title !== undefined ? { title: input.title } : {}),
      };
      items.set(id, next);
      return Promise.resolve(next);
    },
    delete(id: ItemId) {
      return Promise.resolve(items.delete(id));
    },
  };
}
