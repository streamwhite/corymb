const DEFAULT_REDIS_PORT = 6379 as const;

const LOCAL_REDIS_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export type RedisEndpoint = {
  host: string;
  port: number;
  isLocal: boolean;
};

export function parseRedisEndpoint(redisUrl: string): RedisEndpoint {
  const parsed = new URL(redisUrl);
  const host = parsed.hostname;
  const portRaw = parsed.port;
  const port =
    portRaw.length > 0 ? Number.parseInt(portRaw, 10) : DEFAULT_REDIS_PORT;
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid Redis port in URL: ${redisUrl}`);
  }
  return {
    host,
    port,
    isLocal: LOCAL_REDIS_HOSTS.has(host),
  };
}
