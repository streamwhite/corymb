import { describe, expect, it } from "bun:test";
import {
  MSG_ITEM_NOT_FOUND,
  MSG_TITLE_REQUIRED,
} from "@/constants/messages.js";
import { ITEMS_BASE_PATH } from "@/constants/routes.js";
import type { Item } from "@/types/item.js";
import {
  CONCURRENT_CREATE_COUNT,
  HEADER_CONTENT_TYPE,
  MIME_JSON,
} from "./constants.js";
import { createMemoryApp } from "./helpers/app-memory.js";

function jsonHeaders() {
  return { [HEADER_CONTENT_TYPE]: MIME_JSON } as Record<string, string>;
}

describe("items CRUD", () => {
  it("lists empty items", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(ITEMS_BASE_PATH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual([]);
  });

  it("creates and returns item", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(ITEMS_BASE_PATH, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ title: " Alpha " }),
    });
    expect(res.status).toBe(201);
    const item = (await res.json()) as Item;
    expect(item.title).toBe("Alpha");
    expect(typeof item.id).toBe("string");
    expect(typeof item.createdAt).toBe("string");
  });

  it("rejects empty title", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(ITEMS_BASE_PATH, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ title: "   " }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(MSG_TITLE_REQUIRED);
  });

  it("gets item by id", async () => {
    const { app } = createMemoryApp();
    const created = await app.request(ITEMS_BASE_PATH, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ title: "x" }),
    });
    const item = (await created.json()) as Item;
    const res = await app.request(`${ITEMS_BASE_PATH}/${item.id}`);
    expect(res.status).toBe(200);
    const got = (await res.json()) as Item;
    expect(got.id).toBe(item.id);
  });

  it("returns 404 for missing item", async () => {
    const { app } = createMemoryApp();
    const res = await app.request(
      `${ITEMS_BASE_PATH}/00000000-0000-4000-8000-000000000000`,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(MSG_ITEM_NOT_FOUND);
  });

  it("updates item", async () => {
    const { app } = createMemoryApp();
    const created = await app.request(ITEMS_BASE_PATH, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ title: "old" }),
    });
    const item = (await created.json()) as Item;
    const res = await app.request(`${ITEMS_BASE_PATH}/${item.id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ title: "new" }),
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as Item;
    expect(updated.title).toBe("new");
  });

  it("deletes item", async () => {
    const { app } = createMemoryApp();
    const created = await app.request(ITEMS_BASE_PATH, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ title: "gone" }),
    });
    const item = (await created.json()) as Item;
    const del = await app.request(`${ITEMS_BASE_PATH}/${item.id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(204);
    const get = await app.request(`${ITEMS_BASE_PATH}/${item.id}`);
    expect(get.status).toBe(404);
  });

  it("handles concurrent creates", async () => {
    const { app } = createMemoryApp();
    const bodies = await Promise.all(
      Array.from({ length: CONCURRENT_CREATE_COUNT }, async (_, i) => {
        const res = await app.request(ITEMS_BASE_PATH, {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({ title: `task-${String(i)}` }),
        });
        return res.json() as Promise<Item>;
      }),
    );
    expect(new Set(bodies.map((b) => b.id)).size).toBe(CONCURRENT_CREATE_COUNT);
    const list = await app.request(ITEMS_BASE_PATH);
    const items = (await list.json()) as Item[];
    expect(items.length).toBe(CONCURRENT_CREATE_COUNT);
  });
});
