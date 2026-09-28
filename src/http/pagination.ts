import {
  CURSOR_QUERY_PARAM,
  DEFAULT_MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  FIRST_PAGE,
  LIMIT_QUERY_PARAM,
  OFFSET_QUERY_PARAM,
  PAGE_QUERY_PARAM,
  PAGE_SIZE_QUERY_PARAM,
} from "@/constants/pagination.js";
import { ValidationError } from "@/errors/app-error.js";

export type PaginationOptions = {
  defaultPageSize?: number;
  maxPageSize?: number;
  pageParam?: string;
  pageSizeParam?: string;
  limitParam?: string;
  offsetParam?: string;
  cursorParam?: string;
};

export type PaginationParams = {
  limit: number;
  pageSize: number;
  offset: number;
  page: number;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type CursorParams = { limit: number; cursor?: string };

export type CursorMeta = {
  limit: number;
  count: number;
  hasMore: boolean;
  nextCursor?: string;
};

function parsePositiveInt(value: string | null, name: string): number | undefined {
  if (value === null || value.length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`Invalid ${name}`);
  }
  return parsed;
}

function parseNonNegativeInt(
  value: string | null,
  name: string,
): number | undefined {
  if (value === null || value.length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError(`Invalid ${name}`);
  }
  return parsed;
}

/**
 * Parses offset/page pagination from the query string, accepting either
 * `page`+`pageSize` or `offset`+`limit`. Throws `ValidationError` on bad input.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {},
): PaginationParams {
  const maxPageSize = options.maxPageSize ?? DEFAULT_MAX_PAGE_SIZE;
  const pageParam = options.pageParam ?? PAGE_QUERY_PARAM;
  const pageSizeParam = options.pageSizeParam ?? PAGE_SIZE_QUERY_PARAM;
  const limitParam = options.limitParam ?? LIMIT_QUERY_PARAM;
  const offsetParam = options.offsetParam ?? OFFSET_QUERY_PARAM;

  const requestedLimit =
    parsePositiveInt(searchParams.get(limitParam), limitParam) ??
    parsePositiveInt(searchParams.get(pageSizeParam), pageSizeParam);
  const pageSize = Math.min(
    requestedLimit ?? options.defaultPageSize ?? DEFAULT_PAGE_SIZE,
    maxPageSize,
  );

  const requestedPage = parsePositiveInt(searchParams.get(pageParam), pageParam);
  const requestedOffset = parseNonNegativeInt(
    searchParams.get(offsetParam),
    offsetParam,
  );
  const page =
    requestedPage ??
    (requestedOffset === undefined
      ? FIRST_PAGE
      : Math.floor(requestedOffset / pageSize) + FIRST_PAGE);
  const offset =
    requestedOffset ?? (page - FIRST_PAGE) * pageSize;

  return { limit: pageSize, pageSize, offset, page };
}

/** Parses cursor pagination (`cursor` + `limit`). */
export function parseCursorPagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {},
): CursorParams {
  const maxPageSize = options.maxPageSize ?? DEFAULT_MAX_PAGE_SIZE;
  const limitParam = options.limitParam ?? LIMIT_QUERY_PARAM;
  const cursorParam = options.cursorParam ?? CURSOR_QUERY_PARAM;
  const requestedLimit = parsePositiveInt(searchParams.get(limitParam), limitParam);
  const limit = Math.min(
    requestedLimit ?? options.defaultPageSize ?? DEFAULT_PAGE_SIZE,
    maxPageSize,
  );
  const cursor = searchParams.get(cursorParam);
  return cursor === null || cursor.length === 0 ? { limit } : { limit, cursor };
}

/** Builds page metadata from the total row count. */
export function buildPageMeta(
  params: PaginationParams,
  total: number,
): PageMeta {
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.ceil(total / params.pageSize),
    hasNext: params.offset + params.limit < total,
    hasPrev: params.offset > 0,
  };
}

/** Encodes an opaque cursor value as URL-safe base64. */
export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** Decodes a cursor produced by `encodeCursor`, throwing on malformed input. */
export function decodeCursor<T = Record<string, unknown>>(cursor: string): T {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    throw new ValidationError("Invalid cursor");
  }
}

/**
 * Trims an over-fetched page (`limit + 1` rows) to `limit`, deriving the next
 * cursor from the last kept row.
 */
export function buildCursorPage<T>(
  items: readonly T[],
  limit: number,
  cursorOf: (item: T) => unknown,
): { data: T[]; meta: CursorMeta } {
  const hasMore = items.length > limit;
  const data = items.slice(0, limit);
  const last = data[data.length - 1];
  return {
    data,
    meta: {
      limit,
      count: data.length,
      hasMore,
      ...(hasMore && last !== undefined
        ? { nextCursor: encodeCursor(cursorOf(last)) }
        : {}),
    },
  };
}
