import { describe, expect, it } from "bun:test";
import { parseRedisEndpoint } from "../scripts/lib/parse-redis-endpoint.js";

describe("parseRedisEndpoint", () => {
  it("parses host and default port", () => {
    const endpoint = parseRedisEndpoint("redis://localhost");
    expect(endpoint.host).toBe("localhost");
    expect(endpoint.port).toBe(6379);
    expect(endpoint.isLocal).toBe(true);
  });

  it("parses explicit host and port", () => {
    const endpoint = parseRedisEndpoint("redis://127.0.0.1:6380");
    expect(endpoint.host).toBe("127.0.0.1");
    expect(endpoint.port).toBe(6380);
    expect(endpoint.isLocal).toBe(true);
  });

  it("marks remote hosts as non-local", () => {
    const endpoint = parseRedisEndpoint("redis://redis.internal:6379");
    expect(endpoint.isLocal).toBe(false);
  });
});
