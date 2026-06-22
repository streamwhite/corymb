export type Cache = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  ping(): Promise<void>;
};

export type CacheBundle = {
  cache: Cache;
  close(): void;
};
