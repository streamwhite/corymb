import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Hono } from "hono";
import { MSG_INTERNAL } from "@/constants/messages.js";
import type { DbOptions } from "@/db/client.js";
import { createDbBundle } from "@/db/client.js";
import type * as schema from "@/db/schema.js";
import { createAuthRouter } from "@/routes/auth.js";
import { createHealthRouter } from "@/routes/health.js";
import { createItemsRouter } from "@/routes/items.js";
import { createUiRouter } from "@/routes/ui.js";
import { createItemStore, type ItemStore } from "@/store/item-store.js";

export type AppBundle = {
  app: Hono;
  store: ItemStore;
  db: BetterSQLite3Database<typeof schema>;
};

export function createApp(options?: DbOptions): AppBundle {
  const bundle = createDbBundle(options);
  const store = createItemStore(bundle.db);
  const app = new Hono();
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: MSG_INTERNAL }, 500);
  });
  app.route("/", createHealthRouter());
  app.route("/", createUiRouter());
  app.route("/", createAuthRouter(bundle.db));
  app.route("/", createItemsRouter(store));
  return { app, store, db: bundle.db };
}
