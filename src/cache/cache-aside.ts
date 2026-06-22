import type { Cache } from "@/cache/cache-types.js";

export type GetOrLoadOptions<T> = {
  cache: Cache;
  key: string;
  ttlSeconds: number;
  loader: () => Promise<T | undefined>;
};

function parseCachedJson<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function getOrLoad<T>(
  options: GetOrLoadOptions<T>,
): Promise<T | undefined> {
  const { cache, key, ttlSeconds, loader } = options;
  const cached = await cache.get(key);
  if (cached !== null) {
    const parsed = parseCachedJson<T>(cached);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  const loaded = await loader();
  if (loaded === undefined) {
    return undefined;
  }
  await cache.set(key, JSON.stringify(loaded), ttlSeconds);
  return loaded;
}

export async function invalidateKeys(
  cache: Cache,
  keys: string[],
): Promise<void> {
  await Promise.all(keys.map((key) => cache.del(key)));
}
