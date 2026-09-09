declare module "pg" {
  export type PoolConfig = {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };

  export class Pool {
    constructor(config?: PoolConfig | string);
    query(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
    end(): Promise<void>;
    on(event: "error", listener: (err: Error) => void): this;
  }
}
