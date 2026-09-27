declare module "pg" {
  export type QueryResultRow = Record<string, unknown>;

  export type QueryResult<T extends QueryResultRow = QueryResultRow> = {
    rows: T[];
    rowCount: number | null;
  };

  export type PoolConfig = {
    connectionString?: string;
    options?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };

  export type ClientConfig = {
    connectionString?: string;
    options?: string;
  };

  export class Pool {
    constructor(config?: PoolConfig | string);
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    end(): Promise<void>;
    on(event: "error", listener: (err: Error) => void): this;
  }

  export class Client {
    constructor(config?: ClientConfig | string);
    connect(): Promise<void>;
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
