import { Hono } from "hono";
import { MSG_INTERNAL } from "@/constants/messages.js";
import { createHealthRouter } from "@/routes/health.js";
import { createItemsRouter } from "@/routes/items.js";
import { createItemStore, type ItemStore } from "@/store/item-store.js";

export type AppBundle = {
  app: Hono;
  store: ItemStore;
};

export function createApp(store: ItemStore = createItemStore()): AppBundle {
  const app = new Hono();
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: MSG_INTERNAL }, 500);
  });
  app.route("/", createHealthRouter());
  app.route("/", createItemsRouter(store));
  return { app, store };
}
