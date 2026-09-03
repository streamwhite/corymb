import { afterEach, describe, expect, it } from "bun:test";
import {
  ENV_HOST_KEY,
  HOST_DEVELOPMENT,
  HOST_PRODUCTION,
  resolveListenHost,
} from "@/constants/server.js";
import {
  ENV_NODE_ENV,
  NODE_ENV_DEVELOPMENT,
  NODE_ENV_PRODUCTION,
} from "@/constants/tls-dev.js";

const savedHost = process.env[ENV_HOST_KEY];
const savedNodeEnv = process.env[ENV_NODE_ENV];

afterEach(() => {
  if (savedHost === undefined) {
    delete process.env[ENV_HOST_KEY];
  } else {
    process.env[ENV_HOST_KEY] = savedHost;
  }
  if (savedNodeEnv === undefined) {
    delete process.env[ENV_NODE_ENV];
  } else {
    process.env[ENV_NODE_ENV] = savedNodeEnv;
  }
});

describe("resolveListenHost", () => {
  it("binds localhost in development", () => {
    process.env[ENV_NODE_ENV] = NODE_ENV_DEVELOPMENT;
    delete process.env[ENV_HOST_KEY];
    expect(resolveListenHost()).toBe(HOST_DEVELOPMENT);
  });

  it("binds all interfaces in production", () => {
    process.env[ENV_NODE_ENV] = NODE_ENV_PRODUCTION;
    delete process.env[ENV_HOST_KEY];
    expect(resolveListenHost()).toBe(HOST_PRODUCTION);
  });

  it("honors the HOST env override", () => {
    process.env[ENV_NODE_ENV] = NODE_ENV_PRODUCTION;
    process.env[ENV_HOST_KEY] = "127.0.0.1";
    expect(resolveListenHost()).toBe("127.0.0.1");
  });
});
