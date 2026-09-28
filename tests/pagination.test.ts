import { describe, expect, it } from "bun:test";
import { ValidationError } from "@/errors/app-error.js";
import {
  applyCursorLimit,
  applyPageRange,
  toPage,
} from "@/data/postgrest-pagination.js";
import type { PostgrestBuilder } from "@/data/postgrest-builder.js";
import {
  buildCursorPage,
  buildPageMeta,
  decodeCursor,
  encodeCursor,
  parseCursorPagination,
  parsePagination,
} from "@/http/pagination.js";

function query(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

describe("offset/pagination parsing", () => {
  it("defaults to page 1 with the default page size", () => {
    expect(parsePagination(query({}))).toEqual({
      limit: 20,
      pageSize: 20,
      offset: 0,
      page: 1,
    });
  });

  it("supports page + pageSize", () => {
    expect(parsePagination(query({ page: "3", pageSize: "10" }))).toEqual({
      limit: 10,
      pageSize: 10,
      offset: 20,
      page: 3,
    });
  });

  it("supports offset + limit and derives the page", () => {
    expect(parsePagination(query({ offset: "40", limit: "10" }))).toEqual({
      limit: 10,
      pageSize: 10,
      offset: 40,
      page: 5,
    });
  });

  it("clamps the page size to the maximum", () => {
    expect(parsePagination(query({ limit: "1000" })).limit).toBe(100);
  });

  it("rejects invalid values", () => {
    expect(() => parsePagination(query({ page: "0" }))).toThrow(ValidationError);
    expect(() => parsePagination(query({ offset: "-1" }))).toThrow(
      ValidationError,
    );
    expect(() => parsePagination(query({ limit: "abc" }))).toThrow(
      ValidationError,
    );
  });

  it("builds page metadata", () => {
    expect(buildPageMeta({ page: 2, pageSize: 10, offset: 10, limit: 10 }, 25)).toEqual({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });
});

describe("cursor pagination", () => {
  it("parses limit and cursor", () => {
    expect(parseCursorPagination(query({ limit: "5", cursor: "abc" }))).toEqual({
      limit: 5,
      cursor: "abc",
    });
    expect(parseCursorPagination(query({}))).toEqual({ limit: 20 });
  });

  it("round-trips an opaque cursor", () => {
    const value = { id: "row-9", createdAt: "2026-01-01" };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it("rejects a malformed cursor", () => {
    expect(() => decodeCursor("not-base64-json")).toThrow(ValidationError);
  });

  it("trims an over-fetched page and derives the next cursor", () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const page = buildCursorPage(rows, 2, (row) => ({ id: row.id }));
    expect(page.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(page.meta.hasMore).toBe(true);
    expect(page.meta.nextCursor).toBeDefined();
    expect(decodeCursor(page.meta.nextCursor ?? "")).toEqual({ id: 2 });
  });

  it("reports no next cursor on the final page", () => {
    const page = buildCursorPage([{ id: 1 }], 2, (row) => row.id);
    expect(page.meta.hasMore).toBe(false);
    expect(page.meta.nextCursor).toBeUndefined();
  });
});

type RangeStub = PostgrestBuilder<unknown> & { calls: string[] };

function rangeStub(): RangeStub {
  const calls: string[] = [];
  const builder = {
    calls,
    range(from: number, to: number) {
      calls.push(`range:${String(from)}-${String(to)}`);
      return builder;
    },
    limit(count: number) {
      calls.push(`limit:${String(count)}`);
      return builder;
    },
  };
  return builder as unknown as RangeStub;
}

describe("postgrest pagination helpers", () => {
  it("applies the page range", () => {
    const builder = rangeStub();
    applyPageRange(builder, { page: 2, pageSize: 10, offset: 10, limit: 10 });
    expect(builder.calls).toEqual(["range:10-19"]);
  });

  it("over-fetches one row for cursors", () => {
    const builder = rangeStub();
    applyCursorLimit(builder, 5);
    expect(builder.calls).toEqual(["limit:6"]);
  });

  it("maps a counted response to data + metadata", () => {
    const result = toPage(
      { data: [{ id: 1 }], count: 41, status: 200 },
      { page: 1, pageSize: 20, offset: 0, limit: 20 },
    );
    expect(result.meta.total).toBe(41);
    expect(result.meta.hasNext).toBe(true);
  });
});
