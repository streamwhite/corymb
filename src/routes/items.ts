import { Hono } from "hono";
import { MSG_INVALID_JSON, MSG_ITEM_NOT_FOUND } from "@/constants/messages.js";
import { ITEMS_BASE_PATH } from "@/constants/routes.js";
import { parseCreateBody, toUpdateInput } from "@/lib/body-parse.js";
import type { ItemStore } from "@/store/item-store.js";

async function parseJsonUnknown(c: {
  req: { json: () => Promise<unknown> };
}): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  try {
    const raw = await c.req.json();
    return { ok: true, value: raw };
  } catch {
    return { ok: false, error: MSG_INVALID_JSON };
  }
}

export function createItemsRouter(store: ItemStore) {
  const r = new Hono();

  r.get(ITEMS_BASE_PATH, async (c) => {
    const list = await store.list();
    return c.json(list);
  });

  r.post(ITEMS_BASE_PATH, async (c) => {
    const parsed = await parseJsonUnknown(c);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, 400);
    }
    const body = parseCreateBody(parsed.value);
    if (!body.ok) {
      return c.json({ error: body.error }, 400);
    }
    const item = await store.create(body.value);
    return c.json(item, 201);
  });

  r.get(`${ITEMS_BASE_PATH}/:id`, async (c) => {
    const id = c.req.param("id");
    const item = await store.getById(id);
    if (!item) {
      return c.json({ error: MSG_ITEM_NOT_FOUND }, 404);
    }
    return c.json(item);
  });

  r.put(`${ITEMS_BASE_PATH}/:id`, async (c) => {
    const id = c.req.param("id");
    const parsed = await parseJsonUnknown(c);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, 400);
    }
    const updatePayload = toUpdateInput(parsed.value);
    const updated = await store.update(id, updatePayload);
    if (!updated) {
      return c.json({ error: MSG_ITEM_NOT_FOUND }, 404);
    }
    return c.json(updated);
  });

  r.delete(`${ITEMS_BASE_PATH}/:id`, async (c) => {
    const id = c.req.param("id");
    const removed = await store.delete(id);
    if (!removed) {
      return c.json({ error: MSG_ITEM_NOT_FOUND }, 404);
    }
    return c.body(null, 204);
  });

  return r;
}
