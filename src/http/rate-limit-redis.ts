import { RedisClient } from "bun";

/**
 * Atomic fixed-window counter using the same Lua algorithm as
 * `rate-limiter-flexible`'s Redis store, executed via Bun's raw `send`. Keeps
 * counting atomic across replicas without pulling in a node-redis client.
 *
 * Returns `[consumed, ttlMs]`; `ttlMs < 0` means the key had no expiry.
 */
const INCR_TTL_LUA = `redis.call('set', KEYS[1], 0, 'EX', ARGV[2], 'NX')
local consumed = redis.call('incrby', KEYS[1], ARGV[1])
local ttl = redis.call('pttl', KEYS[1])
if ttl == -1 then
  redis.call('expire', KEYS[1], ARGV[2])
  ttl = 1000 * ARGV[2]
end
return {consumed, ttl}`;

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeResult(raw: unknown): [number, number] {
  if (Array.isArray(raw) && raw.length === 2) {
    return [toNumber(raw[0]), toNumber(raw[1])];
  }
  throw new Error("Unexpected Redis rate-limit reply");
}

/** Increments `key` and returns `[consumedPoints, msBeforeNext]`. */
export async function consumeRedisCounter(
  client: RedisClient,
  key: string,
  points: number,
  durationSeconds: number,
): Promise<[number, number]> {
  const reply = await client.send("EVAL", [
    INCR_TTL_LUA,
    "1",
    key,
    String(points),
    String(durationSeconds),
  ]);
  return normalizeResult(reply);
}
