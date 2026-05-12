import { ENV_NODE_ENV, NODE_ENV_DEVELOPMENT } from "@/constants/tls-dev.js";

const NODE_ENV_PRODUCTION = "production" as const;

export function isNodeEnvDevelopment(): boolean {
  return process.env[ENV_NODE_ENV] === NODE_ENV_DEVELOPMENT;
}

export function isNodeEnvProduction(): boolean {
  return process.env[ENV_NODE_ENV] === NODE_ENV_PRODUCTION;
}
