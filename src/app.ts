import { MSG_HTTP_NOT_FOUND, MSG_INTERNAL } from '@/constants/messages.js';
import { closeDbBundle, createDbBundle, type DbOptions } from '@/db/client.js';
import { buildServeRoutes } from '@/server/serve-routes.js';
import type { ItemStore } from '@/store/item-store.js';
import type { SQL } from 'bun';

export type AppInstance = {
  routes: NonNullable<Serve['routes']>;
  fetchNotFound: (req: Request) => Response;
  onServeError: (err: unknown) => Response | Promise<Response>;
  store: ItemStore;
  sql: SQL;
  close: () => Promise<void>;
};

function fetchNotFound(_req: Request): Response {
  return Response.json({ error: MSG_HTTP_NOT_FOUND }, { status: 404 });
}

function onServeError(err: unknown): Response {
  console.error(err);
  return Response.json({ error: MSG_INTERNAL }, { status: 500 });
}

export async function createApp(options?: DbOptions): Promise<AppInstance> {
  const bundle = await createDbBundle(options);
  return {
    routes: buildServeRoutes(bundle),
    fetchNotFound,
    onServeError,
    store: bundle.store,
    sql: bundle.sql,
    close: () => closeDbBundle(bundle),
  };
}
