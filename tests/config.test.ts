import { describe, expect, it } from "bun:test";
import { loadAppConfig } from "@/config/app-config.js";
import { ConfigError } from "@/config/validation.js";

const VALID_ENV = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/app",
  BETTER_AUTH_SECRET: "x".repeat(40),
  POSTGREST_URL: "http://localhost:3001/",
  REDIS_URL: "redis://localhost:6379",
  PORT: "4000",
  LOG_LEVEL: "warn",
  CORS_ORIGINS: "https://a.example.com, https://b.example.com",
  SERVICE_NAME: "api",
} as const;

describe("loadAppConfig", () => {
  it("builds a typed, normalized snapshot", () => {
    const config = loadAppConfig({ ...VALID_ENV });
    expect(config.server.port).toBe(4000);
    expect(config.env.serviceName).toBe("api");
    expect(config.postgrest.url).toBe("http://localhost:3001");
    expect(config.postgrest.schema).toBe("app");
    expect(config.log.level).toBe("warn");
    expect(config.cors.origins).toEqual([
      "https://a.example.com",
      "https://b.example.com",
    ]);
    expect(config.auth.baseURL).toBe("http://localhost:3000");
  });

  it("aggregates every issue into one ConfigError", () => {
    let caught: unknown;
    try {
      loadAppConfig({ DATABASE_URL: "sqlite:./x", LOG_LEVEL: "loud" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const issues = (caught as ConfigError).issues.join("\n");
    expect(issues).toContain("DATABASE_URL must be a PostgreSQL URL");
    expect(issues).toContain("BETTER_AUTH_SECRET is required");
    expect(issues).toContain("LOG_LEVEL must be one of");
  });

  it("rejects wildcard CORS with credentials", () => {
    expect(() =>
      loadAppConfig({
        ...VALID_ENV,
        CORS_ORIGINS: "*",
        CORS_CREDENTIALS: "true",
      }),
    ).toThrow(ConfigError);
  });

  it("rejects a short auth secret and invalid URLs", () => {
    const issues = (() => {
      try {
        loadAppConfig({ ...VALID_ENV, BETTER_AUTH_SECRET: "short", POSTGREST_URL: "not-a-url" });
      } catch (err) {
        return (err as ConfigError).issues.join("\n");
      }
      return "";
    })();
    expect(issues).toContain("BETTER_AUTH_SECRET must be at least 32 characters");
    expect(issues).toContain("POSTGREST_URL must be a valid URL");
  });
});
