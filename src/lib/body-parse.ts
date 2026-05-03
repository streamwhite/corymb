import { MSG_TITLE_REQUIRED } from "@/constants/messages.js";
import type { CreateItemInput, UpdateItemInput } from "@/types/item.js";

export function parseCreateBody(
  body: unknown,
): { ok: true; value: CreateItemInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: MSG_TITLE_REQUIRED };
  }
  const titleRaw = (body as { title?: unknown }).title;
  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (!title) {
    return { ok: false, error: MSG_TITLE_REQUIRED };
  }
  return { ok: true, value: { title } };
}

export function toUpdateInput(body: unknown): UpdateItemInput {
  if (typeof body !== "object" || body === null) {
    return {};
  }
  const titleRaw = (body as { title?: unknown }).title;
  if (titleRaw === undefined || typeof titleRaw !== "string") {
    return {};
  }
  return { title: titleRaw.trim() };
}
