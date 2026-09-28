import type { PostgrestBuilder } from "@/data/postgrest-builder.js";
import type { PostgrestResponse } from "@/data/postgrest-types.js";
import {
  buildPageMeta,
  type PageMeta,
  type PaginationParams,
} from "@/http/pagination.js";

export type PageResult<T> = { data: readonly T[]; meta: PageMeta };

/** Applies an offset/limit window to a PostgREST query builder. */
export function applyPageRange<T>(
  builder: PostgrestBuilder<T>,
  params: PaginationParams,
): PostgrestBuilder<T> {
  return builder.range(params.offset, params.offset + params.limit - 1);
}

/** Limits to `limit + 1` so the caller can detect whether more rows exist. */
export function applyCursorLimit<T>(
  builder: PostgrestBuilder<T>,
  limit: number,
): PostgrestBuilder<T> {
  return builder.limit(limit + 1);
}

/** Turns a counted PostgREST response into data + page metadata. */
export function toPage<T>(
  response: PostgrestResponse<readonly T[]>,
  params: PaginationParams,
): PageResult<T> {
  const total = response.count ?? response.data.length;
  return { data: response.data, meta: buildPageMeta(params, total) };
}
