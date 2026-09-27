import type { PostgrestConfig } from "@/constants/postgrest.js";
import { encodeFilter } from "@/data/postgrest-filter.js";
import { executePostgrest } from "@/data/postgrest-request.js";
import type {
  PostgrestAuth,
  PostgrestFilterOperator,
  PostgrestResponse,
} from "@/data/postgrest-types.js";

const OBJECT_ACCEPT = "application/vnd.pgrst.object+json";
const PREFER_RETURN_REPRESENTATION = "return=representation";
const PREFER_COUNT_EXACT = "count=exact";
const PREFER_MERGE_DUPLICATES = "resolution=merge-duplicates";
const DEFAULT_SELECT = "*";
const FIRST_ROW_INDEX = 0;
const SINGLE_ROW_SPAN = 1;

export type PostgrestDeps = {
  config: PostgrestConfig;
  fetchImpl: typeof fetch;
  auth: PostgrestAuth;
};

export type UpsertOptions = {
  onConflict?: string;
};

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Fluent, thenable query builder for one PostgREST table. Awaiting executes the
 * request; non-2xx responses throw `PostgrestError`.
 */
export class PostgrestBuilder<T = unknown>
  implements PromiseLike<PostgrestResponse<T>>
{
  private method: Method = "GET";
  private readonly query = new URLSearchParams();
  private readonly prefer: string[] = [];
  private body: unknown;
  private accept?: string;

  constructor(
    private readonly deps: PostgrestDeps,
    private readonly path: string,
  ) {}

  select(columns: string = DEFAULT_SELECT): this {
    this.query.set("select", columns);
    return this;
  }

  insert(values: unknown): this {
    this.method = "POST";
    this.body = values;
    this.prefer.push(PREFER_RETURN_REPRESENTATION);
    return this;
  }

  upsert(values: unknown, options?: UpsertOptions): this {
    this.method = "POST";
    this.body = values;
    this.prefer.push(PREFER_MERGE_DUPLICATES, PREFER_RETURN_REPRESENTATION);
    if (options?.onConflict !== undefined) {
      this.query.set("on_conflict", options.onConflict);
    }
    return this;
  }

  update(values: unknown): this {
    this.method = "PATCH";
    this.body = values;
    this.prefer.push(PREFER_RETURN_REPRESENTATION);
    return this;
  }

  delete(): this {
    this.method = "DELETE";
    return this;
  }

  filter(operator: PostgrestFilterOperator, column: string, value: unknown): this {
    this.query.append(column, encodeFilter(operator, value));
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.filter("eq", column, value);
  }

  neq(column: string, value: unknown): this {
    return this.filter("neq", column, value);
  }

  gt(column: string, value: unknown): this {
    return this.filter("gt", column, value);
  }

  gte(column: string, value: unknown): this {
    return this.filter("gte", column, value);
  }

  lt(column: string, value: unknown): this {
    return this.filter("lt", column, value);
  }

  lte(column: string, value: unknown): this {
    return this.filter("lte", column, value);
  }

  like(column: string, value: string): this {
    return this.filter("like", column, value);
  }

  ilike(column: string, value: string): this {
    return this.filter("ilike", column, value);
  }

  is(column: string, value: null | boolean): this {
    return this.filter("is", column, value);
  }

  in(column: string, values: readonly unknown[]): this {
    return this.filter("in", column, values);
  }

  order(column: string, options?: { ascending?: boolean }): this {
    const direction = options?.ascending === false ? "desc" : "asc";
    this.query.append("order", `${column}.${direction}`);
    return this;
  }

  limit(count: number): this {
    this.query.set("limit", String(count));
    return this;
  }

  range(from: number, to: number): this {
    this.query.set("offset", String(from));
    this.query.set("limit", String(Math.max(to - from + SINGLE_ROW_SPAN, FIRST_ROW_INDEX)));
    return this;
  }

  count(): this {
    this.prefer.push(PREFER_COUNT_EXACT);
    return this;
  }

  single(): this {
    this.accept = OBJECT_ACCEPT;
    return this;
  }

  then<TResult1 = PostgrestResponse<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: PostgrestResponse<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute(): Promise<PostgrestResponse<T>> {
    return executePostgrest<T>(this.deps.config, this.deps.fetchImpl, {
      method: this.method,
      path: this.path,
      query: this.query,
      auth: this.deps.auth,
      body: this.body,
      prefer: this.prefer,
      accept: this.accept,
    });
  }
}
