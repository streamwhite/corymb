import { parsePositiveIntEnv } from "@/constants/env-int.js";

/** Default page size when the client does not specify one. */
export const DEFAULT_PAGE_SIZE = 20 as const;

/** Hard ceiling for `limit`/`pageSize` (protects the database). */
export const DEFAULT_MAX_PAGE_SIZE = 100 as const;

export const ENV_PAGE_SIZE = "PAGINATION_PAGE_SIZE" as const;

export const ENV_MAX_PAGE_SIZE = "PAGINATION_MAX_PAGE_SIZE" as const;

export const PAGE_QUERY_PARAM = "page" as const;

export const PAGE_SIZE_QUERY_PARAM = "pageSize" as const;

export const LIMIT_QUERY_PARAM = "limit" as const;

export const OFFSET_QUERY_PARAM = "offset" as const;

export const CURSOR_QUERY_PARAM = "cursor" as const;

export const FIRST_PAGE = 1 as const;

export type PaginationConfig = { defaultPageSize: number; maxPageSize: number };

/** Resolves pagination limits from env with safe defaults. */
export function resolvePaginationConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): PaginationConfig {
  return {
    defaultPageSize: parsePositiveIntEnv(env[ENV_PAGE_SIZE], DEFAULT_PAGE_SIZE),
    maxPageSize: parsePositiveIntEnv(env[ENV_MAX_PAGE_SIZE], DEFAULT_MAX_PAGE_SIZE),
  };
}
