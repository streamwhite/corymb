import type { Cache } from "@/cache/cache-types.js";

export function createNoopCache(): Cache {
  return {
    async get(): Promise<null> {
      return null;
    },
    async set(): Promise<void> {},
    async del(): Promise<void> {},
    async ping(): Promise<void> {},
  };
}
