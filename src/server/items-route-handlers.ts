import { MSG_ITEM_NOT_FOUND } from "@/constants/messages.js";
import { readJsonUnknown } from "@/http/json-body.js";
import { parseCreateBody, toUpdateInput } from "@/lib/body-parse.js";
import type { ItemStore } from "@/store/item-store.js";

export async function handleItemsList(store: ItemStore): Promise<Response> {
  const list = await store.list();
  return Response.json(list);
}

export async function handleItemsCreate(
  req: Request,
  store: ItemStore,
): Promise<Response> {
  const parsed = await readJsonUnknown(req);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const body = parseCreateBody(parsed.value);
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: 400 });
  }
  const item = await store.create(body.value);
  return Response.json(item, { status: 201 });
}

export async function handleItemGet(
  id: string,
  store: ItemStore,
): Promise<Response> {
  const item = await store.getById(id);
  if (!item) {
    return Response.json({ error: MSG_ITEM_NOT_FOUND }, { status: 404 });
  }
  return Response.json(item);
}

export async function handleItemPut(
  id: string,
  req: Request,
  store: ItemStore,
): Promise<Response> {
  const parsed = await readJsonUnknown(req);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const updatePayload = toUpdateInput(parsed.value);
  const updated = await store.update(id, updatePayload);
  if (!updated) {
    return Response.json({ error: MSG_ITEM_NOT_FOUND }, { status: 404 });
  }
  return Response.json(updated);
}

export async function handleItemDelete(
  id: string,
  store: ItemStore,
): Promise<Response> {
  const removed = await store.delete(id);
  if (!removed) {
    return Response.json({ error: MSG_ITEM_NOT_FOUND }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
