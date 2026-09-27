export type PostgrestAuth =
  | { kind: "anonymous" }
  | { kind: "token"; token: string };

export type RpcArgs = Record<string, unknown>;

/** Successful result of a PostgREST request. Errors are thrown as `PostgrestError`. */
export type PostgrestResponse<T> = {
  data: T;
  count: number | null;
  status: number;
};

export type PostgrestFilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "is"
  | "in";

export type FilterValue = string | number | boolean | null | readonly unknown[];

export type InsertPayload<T> = Partial<T> | Array<Partial<T>>;

export type UpdatePayload<T> = Partial<T>;
